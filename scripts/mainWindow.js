const ipc = require('electron').ipcRenderer
let mammoth = require('mammoth')
let docs = [null, null, null]

//The empty slots where the documents will be rendered
let docSlots = [null, null, null]


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


//The image button that activates the input field
let inputFileButtons = document.getElementsByClassName('file-button')

console.log("loaded")

for(let i = 0; i < 3; i++){
	inputFileButtons[i].addEventListener('click', () => {
		console.log(event.target.parentElement.childNodes)
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})
}

//Triggered upon a file being uploaded
function fileAdded(){
	let buttonParent = event.target.parentElement
	let children = event.target.parentElement.childNodes

	//This switch will put the file into the array of docs
	let inputFile = event.target.files[0]
	//Find out which slot it was uploaded to
	let whichDoc
	switch(buttonParent.id){
		case 'block1':
			whichDoc = 0
			break
		case 'block2':
			whichDoc = 1
			//Reveal the next slot if hidden
			document.getElementById('block3').style.display= "inline-block"
			break
		case 'block3':
			whichDoc = 2
	}

	docs[whichDoc] = inputFile


	//Trim the path and file extension
	let filepath = children[1].value
	let filename = filepath.substring(filepath.lastIndexOf("\\") + 1, filepath.lastIndexOf("."))

	/*There will be two<p> tags in the block
	The first will be the "Upload file" => "Uploaded"
	The second will display the document text itself
	*/
	let whichP = 0;
	//Find the <p> in the children
	for(let i = 0; i < children.length; i++){
		if(children[i].tagName === "P"){
			if(whichP === 0){
				children[i].innerHTML = filename + " uploaded successfully"
				whichP++
			} else{
				//Store the <p> where we will render the doc for later use
				docSlots[whichDoc] = children[i]
				break
			}
			
		}
		if(children[i].className === "file-button"){
			event.target.parentElement.removeChild(children[i])
		}
	}
}