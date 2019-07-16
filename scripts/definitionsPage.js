const ipc = require('electron').ipcRenderer

//The unordered list element in the page
let defList = document.getElementById('definition-list')

/*
An array of arrays of [term, definition] for each doc
so [ [ [term, definition], [term, definition], [term, definition] ] , [ [term, definition], [term, definition], [term, definition] ], ...]
When displaying definitions, we will be showing the definitions from the most recent doc
*/

let allDefinitions
let hoverTimer

//When initialized and passed 
ipc.on('loadDefinitions', (event, arg) =>{
	console.log(arg)
	let listItemText
	let listItemNode
	for(let i = 0; i < arg[arg.length-1].length; i++){
		//Create the actual listitem element
		listItemNode = document.createElement("li")
		//Add the text to the element
		listItemText = "\"" + arg[arg.length-1][i][0] + "\" " + arg[arg.length-1][i][1]
		listItemNode.appendChild(document.createTextNode(listItemText))
		defList.appendChild(listItemNode)
	}
	/*
	defList.addEventListener('mousemove', () =>{
		clearTimeout(hoverTimer)
	})
	defList.addEventListener('mousemove', (mouseEvent) =>{
		hoverTimer = setTimeout(() =>{
			//Get the element that was hover'd
			let hoveredElement = document.elementFromPoint(mouseEvent.screenX, mouseEvent.screenY)
			let mousePos = [mouseEvent.screenX, mouseEvent.screenY]
			//Prepare the element to have a hover box appear
			ipc.send('wrapWords', [hoveredElement, mousePos, arg[arg.length-1], document])
		}, 1000)
	})
	defList.addEventListener('mouseout', () =>{
		clearTimeout(hoverTimer)
	})*/
})

