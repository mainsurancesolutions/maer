const ipc = require('electron').ipcRenderer
const fs = require('fs')
const diffMatchPatch = require('diff-match-patch')
const compareScript = require('.\\scripts\\comparison.js')
const saveScript = require('.\\scripts\\saveManager.js')
let mammoth = require('mammoth')

let docBlockHTML = fs.readFileSync('docBlock.html')

//Console block div
let consoleBlock = document.getElementById('console-block')

//The entire block divs for each doc
let docBlocks = document.getElementsByClassName('doc-block')

//The documents themselves, populated with input
let docs = [null, null]

//The empty <p> tags where the documents will be rendered
let docSlots = document.getElementsByClassName('doc')

//Title slots for each doc
let docTitleSlots = document.getElementsByClassName('doc-title')

//"Upload a file" text
let uploadTextSlots = document.getElementsByClassName('upload-text')

let docNicknames = [null, null]

//Buttons on each doc to hide the text from it
let hideButtons = document.getElementsByClassName('hide-button')

document.getElementById('minimize-button').addEventListener('click', () =>{
	ipc.send('minimize')
})

document.getElementById('maximize-button').addEventListener('click', () =>{
	ipc.send('maximize')
})

document.getElementById('close-button').addEventListener('click', () =>{
	ipc.send('close')
})

document.getElementById('restart-button').addEventListener('click', () =>{
	ipc.send('restart')
})

//To add a new file after loading, simply un-hide the last one
//If there is no last one, add a new one
document.getElementById('add-button').addEventListener('click', () =>{
	try{
		docBlocks[docBlocks.length-1].style.display= "inline-block"
		document.getElementsByClassName('file-button')[docBlocks.length-1].style.display= "inline-block"
	} catch{
		docsFull()
	}
})

//The save project button
document.getElementById('save-button').addEventListener('click', () => {
	//Pass the save request to the main process to get the path
	ipc.send('save')
})

//Edit button, opens last doc in default application for the user
document.getElementById('edit-button').addEventListener('click', () =>{
	//find the rightmost doc to edit
	if(docs[docBlocks.length-1] !== null)
		ipc.send('edit', docs[docBlocks.length-1].path)
	else
		ipc.send('edit', docs[docBlocks.length-2].path)
})

//Once we get the path from the main process, we can pass it to the saveScript to save it
ipc.on('savePath', (event, arg) =>{
	saveScript.save(arg, docs, docNicknames)
})

document.getElementById('load-button').addEventListener('click', () => {
	ipc.send('load')
})

//Pass the selected project to be loaded by the saveScript
ipc.on('loadFile', async (event, arg) =>{
	if(arg === undefined)
		return
	let project = await saveScript.load(arg)
	
	//Wait for the files to be fetched first before reading them
	await new Promise((resolve) => {setTimeout(resolve, 5)});

	//Force the creation of new doc slots if needed
	for(let i = 2; i < project[0].length; i++){
		docsFull(true)
	}
	docs = project[0]
	docNicknames = project[1];

	//Basically do the processes as if we just uploaded the files
	let fileButtons = document.getElementsByClassName('file-button')
	for(let j = 0; j < project[0].length; j++){
		//First hide the file upload buttons
		fileButtons[j].style.display= "none"
		//Then show doc titles
		docTitleSlots[j].innerHTML = docNicknames[j]
	}

	//Now compare
	document.getElementById('compare-button').click()
})

//Read and render provided documents
document.getElementById('compare-button').addEventListener('click', () =>{
	//Don't show console if the upload wasn't successful
	let success = compareScript.render(docs, docSlots)
	if(success === true){
		//Hide the last unused slot
		if(docs[docBlocks.length-1] === null)
			docBlocks[docBlocks.length-1].style.display= "none"
		//Show console
		consoleBlock.style.display= "inline-block"
		document.getElementById('edit-button').style.display= "inline-block"
		//Show 'hide' buttons
		for(let i = 0; i < docBlocks.length; i++)
			hideButtons[i].style.display = "inline-block"
		//Show 'save' button
		document.getElementById('save-button').style.display= "inline-block"
		//Change doc titles
		for(let i = 0; i < docBlocks.length; i++){
			docTitleSlots[i].style.display = "inline-block"
			docTitleSlots[i].value = docNicknames[i]
			uploadTextSlots[i].innerHTML = ""
		}
		//Reveal add button
		document.getElementById('add-button').style.display= "inline-block"
	}
})

//Hide a doc
for(let i = 0; i < 2; i++){
	hideButtons[i].addEventListener('click', () => {
		//If it's not hidden, hide it. Otherwise, display it
		if(docSlots[i].style.display !== "none"){
			docSlots[i].style.display = "none"
			docBlocks[i].style.minWidth = "80px"
			docBlocks[i].style.maxWidth = "80px"
			//Move title to the left so it can be seen while hidden
			document.getElementsByClassName('doc-title')[i].style.textAlign = "left"
		}
		else{
			docSlots[i].style.display = "inline-block"
			docBlocks[i].style.minWidth = "20vw"
			docBlocks[i].style.maxWidth = "45vw"
			document.getElementsByClassName('doc-title')[i].style.textAlign = "center"
		}
	})
}

//Hide console
document.getElementById('hide-console').addEventListener('click', () =>{
	consoleBlock.style.display = "none"
})

//The image button that activates the input field to upload files
let inputFileButtons = document.getElementsByClassName('file-button')

for(let i = 0; i < 2; i++){
	inputFileButtons[i].addEventListener('click', () => {
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})
}

//Triggered when a doc name is changed
function nameChange(){
	//Find out which block the nickname belongs to
	let nameChangedBlock = event.target.parentElement
	for(let i = 0; i < docBlocks.length; i++){
		if(docBlocks[i] === nameChangedBlock)
			docNicknames[i] = event.target.value
	}
}

//Triggered upon a file being uploaded
function fileAdded(){
	let buttonParent = event.target.parentElement
	let children = event.target.parentElement.childNodes

	//First get the file from the input that triggered the event
	let inputFile = event.target.files[0]

	//Find out which slot the doc was added to
	let whichDoc = -1
	for(let i = 0; i < docBlocks.length; i++){
		if(docBlocks[i] === buttonParent)
			whichDoc = i
	}
	if(whichDoc === -1)
		throw "Could not find out which slot the file belongs to"

	//Trim the path and file extension to get the filename
	let filepath = children[1].value
	let filename = filepath.substring(filepath.lastIndexOf("\\") + 1, filepath.lastIndexOf("."))
	docNicknames[whichDoc] = filename

	//Store the doc and change the title
	docs[whichDoc] = inputFile
	uploadTextSlots[whichDoc].innerHTML = filename + " uploaded successfully"

	//Find and remove the 'Upload file' button once a file has been uploaded
	for(let i = 0; i < children.length; i++){
		if(children[i].className === "file-button"){
			children[i].style.display = "none"
		}
	}
	//Check if all docs are full
	docsFull()
}

//Check if all slots are full and a new one must be made
//If so, do so and update certain variables
//Force will make it create a new slot no matter what
function docsFull(force = false){
	if(!force){
		for(let i = 0; i < docs.length; i++){
		//If there's an empty slot left, no need to add a new one
		if(docs[i] === null)
			return
		}
	}
	
	//Update the arrays containing all docs/elements from all docs
	docs.push(null)
	let docNumber = docs.length
	docBlocks[docBlocks.length-1].insertAdjacentHTML('afterend', docBlockHTML)
	docBlocks = document.getElementsByClassName('doc-block')
	docSlots = document.getElementsByClassName('doc')
	docTitleSlots = document.getElementsByClassName('doc-title')
	uploadTextSlots = document.getElementsByClassName('upload-text')
	docNicknames.push(null)

	//Activate buttons in new docBlock
	let inputFileButtons = document.getElementsByClassName('file-button')
	inputFileButtons[docNumber-1].addEventListener('click', () => {
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})

	let hideButtons = document.getElementsByClassName('hide-button')
	hideButtons[docNumber-1].addEventListener('click', () => {
		//If it's not hidden, hide it. Otherwise, display it
		if(docSlots[docNumber-1].style.display !== "none"){
			docBlocks[docNumber-1].style.minWidth = "80px"
			docBlocks[docNumber-1].style.maxWidth = "80px"
			docSlots[docNumber-1].style.display = "none"
			//Move title to the left so it can be seen while hidden
			document.getElementsByClassName('doc-title')[docNumber-1].style.textAlign = "left"
		}
		else{
			docSlots[docNumber-1].style.display = "inline-block"
			docBlocks[docNumber-1].style.minWidth = "20vw"
			docBlocks[docNumber-1].style.maxWidth = "45vw"
			document.getElementsByClassName('doc-title')[docNumber-1].style.textAlign = "center"
		}
	})
}