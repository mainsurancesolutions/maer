const ipc = require('electron').ipcRenderer

//The image button that activates the input field
let inputFileButton = document.getElementById('file-button')

console.log("loaded")

inputFileButton.addEventListener('click', () => {
	document.getElementById('file-input').click()
	document.body.removeChild(inputFileButton)
})

function fileAdded(){
	console.log("Uploaded")
	//Trim the path and file extension
	let filepath = document.getElementById('file-input').value
	let filename = filepath.substring(filepath.lastIndexOf("\\") + 1, filepath.lastIndexOf("."))
	document.getElementById('doc-text').innerHTML = filename + " uploaded successfully"
}