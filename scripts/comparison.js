const mammoth = require('mammoth')
const diff = require('node-htmldiff')

//HTML ripped from files as well as error/warning messages
let rippedHtml

module.exports ={
	//Main function, calls readDocs to rip the text, 
	//waits until that's done, then finds and renders differences
	render: async function(files, fields){
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
			findDiffs(fields)
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

	//At LEAST the first 2 docs have to be filled
	let numOfFiles
	if(files.length > 2){
		numOfFiles = files.length-1
		rippedHtml = new Array(files.length-1)
		rippedHtml.fill(null)
	}
	else{
		alert("You must upload at least 2 files to be compared")
		return false
	}

	for(let i=0; i<numOfFiles; i++){
		fields[i].innerHTML = "Processing..."
		await mammoth.convertToHtml({path: files[i].path})
		.then(function(result){
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
*/
function findDiffs(fields){
	//Set first field to simply be the first doc
	fields[0].innerHTML = rippedHtml[0]

	let diffText
	let pTags
	//Iterate through all docs
	for(let i = 1; i < rippedHtml.length; i++){
		fields[i].innerHTML = diff(rippedHtml[i-1], rippedHtml[i])

		//Iterate through all <p> tags in a doc
		pTags = fields[i].getElementsByTagName('p')
		for(let j = 0; j < pTags.length; j++){
			//Iterate through the childNodes of each p tag to find an ins or del
			for(let k = 0; k < pTags[j].childNodes.length; k++){
				if(pTags[j].childNodes[k].tagName === 'INS' || pTags[j].childNodes[k].tagName === 'DEL')
					break
				//If we haven't found an ins or del tag, remove the paragraph
				if(k === pTags[j].childNodes.length-1 && !(pTags[j].childNodes[k].tagName === 'INS' || pTags[j].childNodes[k].tagName === 'DEL')){
					pTags[j].style.display = "none"
					break
				}
			}
		}
	}
}