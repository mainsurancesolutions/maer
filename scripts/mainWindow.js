const ipc = require('electron').ipcRenderer
let docSlots = [null, null, null, null]

/*let addWindowButton = document.getElementById('addWindow')

addWindowButton.addEventListener('click', () => {
	ipc.send('addWindow')
})*/

document.getElementById('minimize-button').addEventListener('click', () =>{
	ipc.send('minimize')
})

document.getElementById('maximize-button').addEventListener('click', () =>{
	ipc.send('maximize')
})

document.getElementById('close-button').addEventListener('click', () =>{
	ipc.send('close')
})


//The image button that activates the input field
let inputFileButtons = document.getElementsByClassName('file-button')

console.log("loaded")

for(let i = 0; i < 4; i++){
	inputFileButtons[i].addEventListener('click', () => {
		console.log(event.target.parentElement.childNodes)
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})
}


function fileAdded(){
	let buttonParent = event.target.parentElement
	let children = event.target.parentElement.childNodes

	//Reveal the next slot if hidden
	switch(buttonParent.id) {
		case 'block2':
			document.getElementById('block3').style.display= "inline-block"
			break
		case 'block3':
			document.getElementById('block4').style.display= "inline-block"
			break
	}

	//Trim the path and file extension
	let filepath = children[1].value
	let filename = filepath.substring(filepath.lastIndexOf("\\") + 1, filepath.lastIndexOf("."))

	//Find the <p> in the children
	for(let i = 0; i < children.length; i++){
		if(children[i].tagName === "P"){
			children[i].innerHTML = filename + " uploaded successfully"
		}
		if(children[i].className === "file-button"){
			event.target.parentElement.removeChild(children[i])
		}
	}

	//Embed document in window
}