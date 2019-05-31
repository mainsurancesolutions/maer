const mammoth = require('mammoth')
const diffMatchPatch = require('diff-match-patch')
let dmp = new diffMatchPatch

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

/*This loop will find all differences between two docs
The array will store all the arrays of differences
ie, on first run we find diffs between doc 1 and 2. Second run finds diffs between 2 and 3
Array first element would be that first set of diffs, second element would be that second set of diffs
*/
async function findDiffs(fields){
	let diffArray = []
	let differences
	fields[0].innerHTML = rippedHtml[0]
	for(let i=0; i<rippedHtml.length-1; i++){
		differences = dmp.diff_main(rippedHtml[i], rippedHtml[i+1])
		dmp.diff_cleanupSemantic(differences)
		diffArray.push(differences)
	}
	//Iterate through array of arrays of differences, writing each deletion/addition to the docBlock 
	//(remember diffArray[0] = differences between doc 1 and 2, etc)
	for(let i=0; i<diffArray.length; i++){
		for(let j=0; j<diffArray[i].length; j++){
			if(diffArray[i][j][0] === -1)
				renderDeletionBlock(diffArray[i][j][1], i+1, fields)
			else if(diffArray[i][j][0] === 1)
				renderAdditionBlock(diffArray[i][j][1], i+1, fields)
			//Remove the "Processing..." text on the last run
			if(j === diffArray.length-1)
				fields[i+1].innerHTML = fields[i+1].innerHTML.substring(13)
		}
	}
}

function renderDeletionBlock(deletedString, docNumber, fields){
	//String from the difference in the previous doc to the end of the paragraph its in
	let diffParagraph = rippedHtml[docNumber-1].substring(
		rippedHtml[docNumber-1].indexOf(deletedString),
		rippedHtml[docNumber-1].indexOf("</p>", rippedHtml[docNumber-1].indexOf(deletedString) + 100)
		)

	/*
	diffParagraphUnchanged: The part of the paragraph with the deletion AFTER the deletion
	diffParagraphUnchangedPrior: The part of the paragraph with the deletion BEFORE the deletion
	*/
	let diffParagraphUnchanged = diffParagraph.substring(deletedString.length)
	let docSplit = rippedHtml[docNumber-1].split(deletedString)
	diffParagraphUnchangedPrior = docSplit[0].substring(
		docSplit[0].lastIndexOf("</p>")
		)
	fields[docNumber].innerHTML += (diffParagraphUnchangedPrior + "<span class=\'deleted\'>" + deletedString + "</span>" + diffParagraphUnchanged)
}

function renderAdditionBlock(addedString, docNumber, fields){
	//String from the difference in the previous doc to the end of the paragraph its in
	let diffParagraph = rippedHtml[docNumber-1].substring(
		rippedHtml[docNumber-1].indexOf(addedString),
		rippedHtml[docNumber-1].indexOf("\n\n", rippedHtml[docNumber-1].indexOf(deletedString))
		)

	let diffParagraphUnchanged = diffParagraph.substring(addedString.length)
	let docSplit = rippedHtml[docNumber-1].split(addedString)
	let diffParagraphUnchangedPrior = docSplit[0].substring(
		docSplit[0].lastIndexOf("</p>")
		)
	fields[docNumber].innerHTML += (diffParagraphUnchangedPrior + "<span class=\'added\'>" + addedString + "</span>" + diffParagraphUnchanged)
}