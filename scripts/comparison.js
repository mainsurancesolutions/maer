const mammoth = require('mammoth')
const diff = require('node-htmldiff')
let hideSectionButton = fs.readFileSync('hideSectionButton.html')

//HTML ripped from files as well as error/warning messages
let rippedHtml

//Will be populated by sections and subsections, in tuples of the format
//[section, [subsections]]
let tableOfContents = []

module.exports ={
	//Main function, calls readDocs to rip the text, 
	//waits until that's done, then finds and renders differences
	render: async function(files, fields, tocBlock){
		readDocs(files, fields)
		function ensureHtmlIsSet() {
		    return new Promise(function (resolve, reject) {
		        (function waitForHtml(){
		            if (rippedHtml[rippedHtml.length-1]) return resolve();
		            setTimeout(waitForHtml, 5000);
		        })();
		    });
		}
		ensureHtmlIsSet().then(function(){
			findDiffs(fields, tocBlock)
		})
		return true
	}
}

/*Reads the contents of a docx and converts it to html
files: array of all uploaded docx files
field: array of <p> tags. This is where the html will go
Possible for some or all elements to be null
*/
async function readDocs(files, fields){
	let numOfFiles
	if(files.length > 2){
		numOfFiles = files.length-1
		rippedHtml = new Array(files.length-1)
		rippedHtml.fill(null)
	}
	//Map docx styles to html styles
	let options = {
		styleMap: [
			"p[style-name='Corp 1'] => h1:fresh",
			"p[style-name='MTGen1 L1'] => h1:fresh",
			"p[style-name='Article_L1'] => h1:fresh",
			"p[style-name='Heading 1'] => h1:fresh",
			"p[style-name='Corp 2'] => h2:fresh",
			"p[style-name='MTGen2 L2'] => h2:fresh",
			"p[style-name='Article_L2'] => h2:fresh",
			"p[style-name='Heading 2'] => h2:fresh",
			"p[style-name='Heading 3'] => p:fresh",
			"p[style-name='Heading 4'] => p:fresh",
			"p[style-name='u'] => em:fresh"
		]
	}
	for(let i=0; i<numOfFiles; i++){
		fields[i].innerHTML = "Processing..."
		await mammoth.convertToHtml({path: files[i].path}, options)
		.then(function(result){
			if(rippedHtml[i] !== "")
				rippedHtml[i] = result.value //Html generated from docx
		})
		.done()
	}
	return true
}

/*
This loop will find all differences between two docs
It will call the diffs pacakge to return a new html text with the 
diffs pointed out. Insertions in <ins>, deletions in <del>
Updating the text fields for the 2nd parameter as it goes
It will also generate the table of contents as it goes
*/
function findDiffs(fields, tocBlock){
	//Set first field to simply be the first doc
	fields[0].innerHTML = rippedHtml[0]

	let diffText
	let docElements
	//We will keep track of all sections that had changes
	//That way when we populate the table of contents, we can mark which changed
	let changedHeaders = []
	let showNextH1 = false
	let showNextH2 = false
	//Iterate through all docs
	for(let i = 1; i < rippedHtml.length; i++){
		fields[i].innerHTML = diff(rippedHtml[i-1], rippedHtml[i])

		//See section comments at the top. We will push subsections to this then
		//push this + the section title to the tableOfContents
		subSections = []

		//Iterate through all elements in a doc backwards
		docElements = fields[i].childNodes
		for(let j = docElements.length-1; j >= 0; j--){
			switch(docElements[j].tagName){
				//If we found a tag with changes, we wanna show the category/subcategory before it
				case 'H1':
					//We only wanna catalogue the table of contents once
					if(i === 1){
						tableOfContents.push([docElements[j].textContent, subSections.reverse()])
						subSections = []
					}
					if(showNextH1){
						showNextH1 = false
						//We only care if the last version has changes
						if(i === rippedHtml.length-1)
							changedHeaders.push(docElements[j].textContent)
					}
					else
						docElements[j].style.display = "none"
					
					break
				case 'H2':
					if(i === 1){
						subSections.push(docElements[j].textContent)
					}
					if(showNextH2){
						showNextH2 = false
						if(i === rippedHtml.length-1)
							changedHeaders.push(docElements[j].textContent)
					}
					else
						docElements[j].style.display = "none"					
					break
				default:
					//Check if its has insertions/deletions
					for(let k = 0; k < docElements[j].childNodes.length; k++){
						//If we find a change, we leave it visible and make sure the next h2/h3 tags are shown
						if(docElements[j].childNodes[k].tagName === 'INS' || docElements[j].childNodes[k].tagName === 'DEL'){
							showNextH2 = true
							showNextH1 = true
							break
						}
						//If we haven't found an ins or del tag, remove the paragraph
						if(k === docElements[j].childNodes.length-1 && !(docElements[j].childNodes[k].tagName === 'INS' || docElements[j].childNodes[k].tagName === 'DEL')){
							docElements[j].style.display = "none"
							break
						}
					}
					break
			}
		}
		
		if(i === rippedHtml.length-1){
			tableOfContents.reverse()
			/*
			Fill the table of contents
			The contents will be of the form
			[[section, [subsections]], [section, [subsections]], ...]
			So we will iterate through the array to each [section, [subsections]]
			Then create a new listitem for each section with a sub-list and listitems for each subsection
			Use a counter to determine subsection numbers
			*/
			let newListItem
			let subsectionNumberString = ""
			let document = tocBlock.ownerDocument
			let hideSectionButtonElement = document.createElement('span')
			hideSectionButtonElement.innerHTML = hideSectionButton
			for(let i = 0; i < tableOfContents.length; i++){
				newListItem = document.createElement("li")
				newListItem.classList.add("section")
				//If the section contained a change, add the 'changed' class to it
				if(changedHeaders.includes(tableOfContents[i][0]))
					newListItem.classList.add("changed")
				newListItem.appendChild(document.createTextNode((i+1) + ". " + tableOfContents[i][0]))
				tocBlock.appendChild(newListItem)
				tocBlock.insertBefore(hideSectionButtonElement.cloneNode(true), newListItem)
				for(let j = 0; j < tableOfContents[i][1].length; j++){
					//Subsection number must be of the form 1.01, 1.02, 1.03, ..., 1.10, 1.11, ...
					if(j < 9)
						subsectionNumberString = (i + 1) + ".0" + (j + 1) + ". "
					else
						subsectionNumberString = (i + 1) + "." + (j + 1) + ". "
					newSubListItem = document.createElement("li")
					newSubListItem.classList.add("subsection")
					if(changedHeaders.includes(tableOfContents[i][1][j]))
						newSubListItem.classList.add("changed")
					newSubListItem.appendChild(document.createTextNode(subsectionNumberString + tableOfContents[i][1][j]))
					tocBlock.appendChild(newSubListItem)
					newSubListItem.style.display = "none"
				}
			}
		}
	}
}