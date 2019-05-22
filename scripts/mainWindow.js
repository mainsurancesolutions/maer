const ipc = require('electron').ipcRenderer
const compareScript = require('.\\scripts\\comparison.js')
let mammoth = require('mammoth')

//The documents themselves, populated with input
let docs = [null, null, null]

//The empty <p> tags where the documents will be rendered
let docSlots = document.getElementsByClassName('doc')

//Title slots for each doc
let docTitleSlots = document.getElementsByClassName('doc-title')



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

//Read and render provided documents
document.getElementById('compare-button').addEventListener('click', () =>{
	//Don't show console/hide third slot if the upload wasn't successful
	let success = compareScript.render(docs, docSlots)
	if(success){
		//Hide the third slot if it wasn't used
		if(docSlots[2] === null)
			document.getElementById('block3').style.display= "none"
		//Hide compare button to free space
		document.getElementById('compare-button').style.display= "none"
		document.getElementById('console-block').style.display= "inline-block"
	}
	
})


//The image button that activates the input field
let inputFileButtons = document.getElementsByClassName('file-button')

console.log("loaded")

for(let i = 0; i < 3; i++){
	inputFileButtons[i].addEventListener('click', () => {
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})
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

	//Store the doc and change the title
	docs[whichDoc] = inputFile
	docTitleSlots[whichDoc].innerHTML = filename + " uploaded successfully"

	//Find and remove the 'Upload file' button once a file has been uploaded
	for(let i = 0; i < children.length; i++){
		if(children[i].className === "file-button"){
			event.target.parentElement.removeChild(children[i])
		}
	}
}