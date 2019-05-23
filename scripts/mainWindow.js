const ipc = require('electron').ipcRenderer
const compareScript = require('.\\scripts\\comparison.js')
const saveScript = require('.\\scripts\\saveManager.js')
let mammoth = require('mammoth')

//The documents themselves, populated with input
let docs = [null, null, null]

//The empty <p> tags where the documents will be rendered
let docSlots = document.getElementsByClassName('doc')

//Title slots for each doc
let docTitleSlots = document.getElementsByClassName('doc-title')

//"Upload a file" text
let uploadTextSlots = document.getElementsByClassName('upload-text')

let docNicknames = [null, null, null]

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

//The save project button
document.getElementById('save-button').addEventListener('click', () => {
	//Pass the save request to the main process to get the path
	ipc.send('save')
})

//Once we get the path from the main process, we can pass it to the saveScript to save it
ipc.on('savePath', (event, arg) =>{
	if(arg !== undefined)
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
	await new Promise((resolve) => {setTimeout(resolve, 50) });
	docs = project[0]
	docNicknames = project[1]
	//Basically do the processes as if we just uploaded the files
	let fileButtons = document.getElementsByClassName('file-button')
	
	for(let i = 0; i < project[0].length; i++){
		//First hide the file upload buttons
		fileButtons[i].style.display= "none"
		//Then show doc titles
		docTitleSlots[i].innerHTML = docNicknames[i]
	}

	//Now compare
	document.getElementById('compare-button').click()
})

//Read and render provided documents
document.getElementById('compare-button').addEventListener('click', () =>{
	//Don't show console/hide third slot if the upload wasn't successful
	let success = compareScript.render(docs, docSlots)
	if(success){
		//Hide the third slot if it wasn't used
		if(docs[2] === null)
			document.getElementById('block3').style.display= "none"
		else
			document.getElementById('block3').style.display= "inline-block"
		//Hide compare button to free space and show console
		document.getElementById('compare-button').style.display= "none"
		document.getElementById('console-block').style.display= "inline-block"
		//Show 'hide' buttons
		for(let i = 0; i < 3; i++)
			hideButtons[i].style.display = "inline-block"
		//Show 'save' button
		document.getElementById('save-button').style.display= "inline-block"
		//Change doc titles
		for(let i = 0; i < 3; i++){
			docTitleSlots[i].style.display = "inline-block"
			docTitleSlots[i].value = docNicknames[i]
			uploadTextSlots[i].innerHTML = ""
		}
	}
})

//Hide a doc
for(let i = 0; i < 3; i++){
	hideButtons[i].addEventListener('click', () => {
		//If it's not hidden, hide it. Otherwise, display it
		if(docSlots[i].style.display !== "none")
			docSlots[i].style.display = "none"
		else
			docSlots[i].style.display = "inline-block"
	})
}

//The image button that activates the input field to upload files
let inputFileButtons = document.getElementsByClassName('file-button')

for(let i = 0; i < 3; i++){
	inputFileButtons[i].addEventListener('click', () => {
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})
}

//Triggered when a doc name is changed
function nameChange(){
	//Find out which block the nickname belongs to
	let blockId = event.target.parentElement.id
	switch(blockId){
		case 'block1':
			docNicknames[0] = event.target.value
			break
		case 'block2':
			docNicknames[1] = event.target.value
			break
		case 'block3':
			docNicknames[2] = event.target.value
	}
}

//Triggered upon a file being uploaded
function fileAdded(){
	let buttonParent = event.target.parentElement
	let children = event.target.parentElement.childNodes

	//First get the file from the input that triggered the event
	let inputFile = event.target.files[0]

	//This switch will put the file into the array of docs after finding the slot
	let whichDoc
	switch(buttonParent.id){
		case 'block1':
			whichDoc = 0
			//Reveal the next slot if hidden and the other slot has also been filled
			if(docs[1] !== null)
				document.getElementById('block3').style.display= "inline-block"
			break
		case 'block2':
			whichDoc = 1
			if(docs[0] !== null)
				document.getElementById('block3').style.display= "inline-block"
			break
		case 'block3':
			whichDoc = 2
	}

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
			event.target.parentElement.removeChild(children[i])
		}
	}
}