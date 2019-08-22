const mammoth = require('mammoth')
const diff = require('node-htmldiff')
const fs = require('fs')
const hideSectionButton = fs.readFileSync('hideSectionButton.html')
const hideArticleButton = fs.readFileSync('hideArticleButton.html')
const hideParagraphsButton = fs.readFileSync('hideParagraphsButton.html')
const revealText = fs.readFileSync('revealText.html')

//HTML ripped from files as well as error/warning messages
let rippedHtml

//Will be populated by sections and subsections, in tuples of the format
//[section, [subsections]]
let tableOfContents = []

//Create an alphabetical array for labelling subsections
let alphabet = ["a", "b", "c", "d", "e", "f", "g", "h",
				"i", "j", "k", "l", "m", "n", "o", "p", 
				"q", "r", "s", "t", "u", "v", "w", "x", 
				"y", "z"]

module.exports ={
	//Main function, calls readDocs to rip the text, 
	//waits until that's done, then finds and renders differences
	render: async function(files, fields, tocBlock){
		//Will return false if it fails to read the files
		if(await readDocs(files, fields) === false)
			return false
		function ensureHtmlIsSet() {
		    return new Promise(function (resolve, reject) {
		        (function waitForHtml(){
		        	//Make sure all docs have been loaded in
		        	for(let i = 0; i < files.length - 1; i++){
		        		//if we made it through all docs without finding a null or undefined, we're good
		        		if(i === files.length-2 && rippedHtml[i] !== null && rippedHtml[i] !== undefined)
		        			return resolve()
		        		if(rippedHtml[i] === null || rippedHtml[i] === undefined)
		        			break
		        	}
		            setTimeout(waitForHtml, 125)
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
			"p[style-name='Heading 3'] => p.subsection-bullet:fresh",
			"p[style-name='Heading 4'] => p.subsection-sub-bullet:fresh"
		]
	}
	for(let i=0; i<numOfFiles; i++){
		fields[i].innerHTML = "Processing..."
		try{
			//Most common reason it will fail to read a file is if the user moved or deleted one of the files to be read
			if(fs.existsSync(files[i].path)){
				await mammoth.convertToHtml({path: files[i].path}, options)
				.then(function(result){
					if(rippedHtml[i] !== "")
						rippedHtml[i] = result.value //Html generated from docx
				})
				.done()
			}
			else
				return false			
		}catch (e){
			return false
		}
		
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
async function findDiffs(fields, tocBlock){
	//Set first field to simply be the first doc
	fields[0].innerHTML = rippedHtml[0]

	let docElements
	//We will keep track of all sections that had changes
	//That way when we populate the table of contents, we can mark which changed
	let changedHeaders = []
	let showNextH1 = false
	let showNextH2 = false
	let showNextSubsection = false
	let hideNextRevealText = false

	//Clear the table of contents in case it was already populated
	//Helper function to ensure it's cleared before proceeding
	let tableOfContentsElement = fields[0].ownerDocument.getElementById('table-of-contents')
	function clearTable(table){
		return new Promise(function(resolve, reject){
			(function clear(){
				while(table.firstChild !== null){
					table.removeChild(table.firstChild)
				}
				return resolve()
			})()
		})
	}
	tableOfContents = []
	clearTable(tableOfContentsElement).then(()=>{
		//Iterate through all docs
		for(let i = 1; i < rippedHtml.length; i++){
			fields[i].innerHTML = diff(rippedHtml[i-1], rippedHtml[i])

			//See section comments at the top. We will push subsections to this then
			//push this + the section title to the tableOfContents
			subSections = []

			//Iterate through all elements in a doc backwards
			docElements = fields[i].childNodes
			showNextH1 = false
			showNextH2 = false
			for(let j = docElements.length-1; j >= 0; j--){
				switch(docElements[j].tagName){
					//If we found a tag with changes, we wanna show the category/subcategory before it
					case 'H1':
						//We only wanna catalogue the table of contents once
						if(i === rippedHtml.length-1){
							tableOfContents.push([docElements[j].textContent, subSections.reverse()])
							subSections = []
						}
						if(showNextH1){
							showNextH1 = false
							//We only care if the last version has changes
							if(i === rippedHtml.length-1)
								changedHeaders.push(docElements[j].textContent)
						}
						break
					case 'H2':
						docElements[j].insertAdjacentHTML('afterend', revealText)
						if(i === rippedHtml.length-1){
							subSections.push(docElements[j].textContent)
						}
						if(showNextH2){
							showNextH2 = false
							if(i === rippedHtml.length-1)
								changedHeaders.push(docElements[j].textContent)
						}
						break
					default:
						//Check if it has insertions/deletions
						for(let k = 0; k < docElements[j].childNodes.length; k++){
							//If we find a change, we leave it visible and make sure the next h2/h3 tags are shown
							if(docElements[j].childNodes[k].tagName === 'INS' || docElements[j].childNodes[k].tagName === 'DEL'){
								docElements[j].classList.add('changed-paragraph')
								showNextH2 = true
								showNextH1 = true
								//If the changed paragraph is a sub-subsection, we want to show the subsection it's under
								if(docElements[j].classList.contains('subsection-sub-bullet'))
									showNextSubsection = true
								break
							}
							//If we haven't found an ins or del tag, remove the paragraph
							//UNLESS it's a subsection header containing a changed sub-subsection
							if(docElements[j].classList.contains('subsection-bullet') && showNextSubsection){
								docElements[j].classList.add('changed-paragraph')
								showNextSubsection = false
								break
							}
							if(k === docElements[j].childNodes.length-1 && !(docElements[j].childNodes[k].tagName === 'INS' || docElements[j].childNodes[k].tagName === 'DEL')){
								//If the element has children (a table for example), we'll need
								//to check all the children for changes
								if(docElements[j].childNodes[k].childNodes.length > 0){
									if(childrenChanged(docElements[j].childNodes[k])){
										docElements[j].childNodes[k].classList.add('changed-paragraph')
										break
									}
								}
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
					//Create a new listItem with the 'section' class to add to the visible table of contents
					newListItem = document.createElement("li")
					newListItem.classList.add("section")
					//If the section contained a change, add the 'changed' class to it
					if(changedHeaders.includes(tableOfContents[i][0]))
						newListItem.classList.add("changed")
					//Add the section number and name to the listitem
					newListItem.appendChild(document.createTextNode((i+1) + ". " + tableOfContents[i][0]))
					tocBlock.appendChild(newListItem)
					tocBlock.insertBefore(hideSectionButtonElement.cloneNode(true), newListItem)
					for(let j = 0; j < tableOfContents[i][1].length; j++){
						//Subsection number must be of the form 1.01, 1.02, 1.03, ..., 1.10, 1.11, ...
						if(j < 9)
							subsectionNumberString = (i + 1) + ".0" + (j + 1) + " "
						else
							subsectionNumberString = (i + 1) + "." + (j + 1) + " "
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

		//Remove all supertext, which can cause some issues
		let superText = tocBlock.ownerDocument.getElementsByTagName('SUP')
		for(let i = superText.length-1; i >= 0; i--){
			superText[i].parentElement.removeChild(superText[i])
		}
		numberSections(fields)
	})

	//Hide the 'Reveal unhidden text' buttons if the section is hidden
	for(let i = 1; i < rippedHtml.length; i++){
		//Update the list of elements in the document
		docElements = await fields[i].childNodes
		for(let j = 0; j < docElements.length; j++){
			switch(docElements[j].tagName){
				//If we found a section header, find the dropdown button in that header
				case 'H2':
					if(docElements[j].getElementsByTagName('INPUT').length > 0){
						if(docElements[j].getElementsByTagName('INPUT')[0].src.includes("images/showSection.png"))
							hideNextRevealText = true
					}
					break
				case 'BUTTON':
					if(hideNextRevealText){
						docElements[j].style.display = "none"
						hideNextRevealText = false
					}
					break
			}
		}
	}
		
}
//Add article/section numbers to documents as well as buttons to collapse them
//We will also add the (a), (b), (c), etc. bullet points to sections here
//Iterate through each doc
function numberSections(docSlots){
	//Do the following operations on each document
	for(let i = 0; i < docSlots.length; i++){
		//Start counters for what article number and section number we're on
		let articleNumber = 0
		let sectionNumber = 1
		let subsectionNumber = 0
		let subsubsectionNumber = 1
		//Now we iterate through all the children nodes of the doc for the headers
		let docElements = docSlots[i].childNodes
		for(let j = 0; j < docElements.length; j++){
			switch(docElements[j].tagName){
				//If we a header, add the section or subsection number to the front
				//We also add a button to each header to hide their text
				case 'H1':
					articleNumber++
					docElements[j].innerText = "ARTICLE " + articleNumber + " " + docElements[j].innerText
					sectionNumber = 1
					docElements[j].insertAdjacentHTML('afterbegin', hideArticleButton)
					break
				case 'H2':
					if(sectionNumber > 9)
						docElements[j].innerText = articleNumber + "." + sectionNumber + " " + docElements[j].innerText
					else
						docElements[j].innerText = articleNumber + ".0" + sectionNumber + " " + docElements[j].innerText
					docElements[j].insertAdjacentHTML('afterbegin', hideParagraphsButton)
					sectionNumber++
					subsectionNumber = 0
					break
				//Determine if the paragraph is a bullet point in a section/subsection
				case 'P':
					if(docElements[j].innerHTML.includes("<br>")){
						docElements[j].innerHTML = docElements[j].innerHTML.replace(new RegExp('<br>', 'g'), '')
					}
					if(docElements[j].innerText.length > 0){
						if(docElements[j].classList.contains('subsection-bullet')){
							subsubsectionNumber = 1
							//Start numbering like (aa), (bb), (cc), etc if we've gone past (z)
							if(subsectionNumber <= 25)
								docElements[j].innerHTML = "(" + alphabet[subsectionNumber] + ") " + docElements[j].innerHTML
							else{
								docElements[j].innerHTML = "(" + alphabet[subsectionNumber % 26] + alphabet[subsectionNumber % 26] + ") " + docElements[j].innerHTML
							}
							subsectionNumber++
							break
						}
						else if(docElements[j].classList.contains('subsection-sub-bullet')){
							docElements[j].innerHTML = "(" + romanize(subsubsectionNumber) + ") " + docElements[j].innerHTML
							subsubsectionNumber++
							break
						}
						else
							break
					}
					else
						break
			}
		}
		//Add a listener to each 'hide article' button
		//Articles will all be shown by default
		let articleButtons = docSlots[i].getElementsByClassName('hide-article')
		let hiddenArticle = false
		for(let j = 0; j < articleButtons.length; j++){
			/*
			Start the buttons in the correct position
			We do this by iterating through the doc, starting from the article header
			until we find either an unhidden paragraph or another article header
			if we've made it to the next article, it means this article is hidden
			if we find a paragraph first, it means this article is shown
			*/
			for(let k = Array.from(docElements).indexOf(articleButtons[j].parentElement) + 1; k < docElements.length; k++){
				if(docElements[k].tagName === "H1"){
					hiddenArticle = true
					break
				}
				if(docElements[k].tagName !== "H2" && docElements[k].style.display !== "none" && !docElements[k].classList.contains("reveal-text")){
					break
				}
			}
			articleButtons[j].addEventListener('click', ()=>{
				/*
				The 'hide article' buttons will work as follows
				Obtain a list of each child node of a doc
				Starting from the clicked article, go through the tags beneath it, hiding each one
				Change the 'hide section' buttons on the sections to reflect being hidden
				Stop hiding once you reach the next section
				If the article is already hidden, do the following to show them:
				Change the button, and then show *only* the section headers, allowing the user to click on
				them if they so choose
				*/
				docElements = Array.from(docSlots[i].childNodes)
				foundASection = false
				//Show items
				if(articleButtons[j].src.includes("images/showSection.png")){
					//Start with the element right after the article title
					for(let k = docElements.indexOf(event.target.parentElement) + 1; k < docElements.length; k++){
						//Stop once we reach the next article
						if(docElements[k].tagName === "H1")
							break
						//Set the display style to the default if they're to be shown
						if(docElements[k].tagName === "H2"){
							docElements[k].style.display = ""
							foundASection = true
						}
					}
					//We must account for the possibility of the article not having any sections
					//If no sections were found, it means this article has the text within it directly, so we can treat it as a section
					if(!foundASection){
						for(let k = docElements.indexOf(event.target.parentElement) + 1; k < docElements.length; k++){
							if(docElements[k].tagName === "H1" || docElements[k].tagName === "H2")
								break
							docElements[k].style.display = ""
							//If the section contains changes, it will have a 'Show hidden text' button
							//If so, we wanna change that to 'Hide unchanged text' when we re-open a section
							if(docElements[k].tagName === 'BUTTON')
								docElements[k].innerText = "Hide unchanged text"
						}
						
					}
					foundASection = false
					articleButtons[j].src = "images/hideSection.png"
				}
				//Hide items
				else{
					for(let k = docElements.indexOf(event.target.parentElement) + 1; k < docElements.length; k++){
						if(docElements[k].tagName === "H1")
							break
						//change the button on the section headers to reflect being hidden
						if(docElements[k].tagName === "H2"){
							docElements[k].childNodes[0].src = "images/showSection.png"
							foundASection = true
						}
						docElements[k].style.display = "none"
					}
					if(!foundASection){
						for(let k = docElements.indexOf(event.target.parentElement) + 1; k < docElements.length; k++){
							if(docElements[k].tagName === "H1" || docElements[k].tagName === "H2")
								break
							docElements[k].style.display = "none"
						}
					}
					foundASection = false
					articleButtons[j].src = "images/showSection.png"
				}
			})
			//If the article starts hidden, hide all section headers in it
			if(hiddenArticle)
				articleButtons[j].click()
			hiddenArticle = false
		}

		//Do the same for the 'hide paragraphs' buttons that will show for each subsection of an article
		let sectionButtons = docSlots[i].getElementsByClassName('hide-paragraphs')
		for(let j = 0; j < sectionButtons.length; j++){
			for(let k = Array.from(docElements).indexOf(sectionButtons[j].parentElement) + 1; k < docElements.length; k++){
				if(docElements[k].tagName === "H1" || docElements[k].tagName === "H2")
					break
				if(docElements[k].style.display !== "none" && !docElements[k].classList.contains("reveal-text")){
					sectionButtons[j].src = "images/hideSection.png"
					break
				}
			}
			sectionButtons[j].addEventListener('click', ()=>{
				docElements = Array.from(docSlots[i].childNodes)
				//Show items
				if(sectionButtons[j].src.includes("images/showSection.png")){
					//Start with the element right after the section title
					for(let k = docElements.indexOf(event.target.parentElement) + 1; k < docElements.length; k++){
						if(docElements[k].tagName === "H1" || docElements[k].tagName === "H2")
							break
						docElements[k].style.display = ""
						//If the section contains changes, it will have a 'Show hidden text' button
						//If so, we wanna change that to 'Hide unchanged text' when we re-open a section
						if(docElements[k].tagName === 'BUTTON')
							docElements[k].innerText = "Hide unchanged text"
					}
					sectionButtons[j].src = "images/hideSection.png"
				}
				//Hide items
				else{
					for(let k = docElements.indexOf(event.target.parentElement) + 1; k < docElements.length; k++){
						if(docElements[k].tagName === "H1" || docElements[k].tagName === "H2")
							break
						docElements[k].style.display = "none"
					}
					sectionButtons[j].src = "images/showSection.png"
				}
			})
		}
		//Set up listeners for the "Show hidden text" buttons
		if(i > 0){
			let revealTextButtons = docSlots[i].getElementsByClassName('reveal-text')
			for(let j = 0; j < revealTextButtons.length; j++){
				revealTextButtons[j].addEventListener('click', () =>{
					docElements = Array.from(docSlots[i].childNodes)
					//If the button is set to reveal, show all 
					if(revealTextButtons[j].innerText !== "Hide unchanged text"){
						for(let k = docElements.indexOf(revealTextButtons[j]) + 1; k < docElements.length; k++){
							if(docElements[k].tagName === 'H1' || docElements[k].tagName === 'H2')
								break
							docElements[k].style.display = ""
						}
						revealTextButtons[j].innerText = "Hide unchanged text"
					}
					//If the button is set to hide unchanged, do just that
					else{
						for(let k = docElements.indexOf(revealTextButtons[j]) + 1; k < docElements.length; k++){
							if(docElements[k].tagName === 'H1' || docElements[k].tagName === 'H2')
								break
							if(!docElements[k].classList.contains('changed-paragraph'))
								docElements[k].style.display = "none"
						}
						revealTextButtons[j].innerText = "Show all text"
					}
					
				})
			}
		}
	}
}

/*
Iterates through the children of an element (recursively if needed) to find out if it contains changes
If it contains changes, return true
otherwise, false
*/
function childrenChanged(elem){
	for(let i = 0; i < elem.childNodes.length; i++){
		if(elem.childNodes[i].tagName === 'INS' || elem.childNodes[i].tagName === 'DEL')
			return true
		//If the child has children, recurse to check those children for changes
		if(elem.childNodes[i].childNodes.length > 0){
			if(childrenChanged(elem.childNodes[i]))
				return true
		}
	}
	//If we've checked all children and not found a change, return false
	return false
}

//Converts an integer to a roman numeral
function romanize (num) {
    if (isNaN(num))
        return NaN;
    var digits = String(+num).split(""),
        key = ["","c","cc","ccc","cd","d","dc","dcc","dccc","cm",
               "","x","xx","xxx","xl","l","lx","lxx","lxxx","xc",
               "","i","ii","iii","iv","v","vi","vii","viii","ix"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}