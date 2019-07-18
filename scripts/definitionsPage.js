const ipc = require('electron').ipcRenderer

//The unordered list element in the page
/*
An array of arrays of [term, definition] for each doc
so [ [ [term, definition], [term, definition], [term, definition] ] , [ [term, definition], [term, definition], [term, definition] ], ...]
When displaying definitions, we will be showing the definitions from the most recent doc
*/

let allDefinitions
let hoverTimer

//When initialized and passed 
ipc.on('loadDefinitions', (event, arg) =>{
	let listItemText
	let listItemNode
	for(let i = 0; i < arg[arg.length-1].length; i++){
		//Create the actual listitem element
		listItemNode = document.createElement("p")
		//Add the text to the element
		listItemText = "\"" + arg[arg.length-1][i][0] + "\" " + arg[arg.length-1][i][1]
		listItemNode.appendChild(document.createTextNode(listItemText))
		document.body.appendChild(listItemNode)
	}
	
	document.body.addEventListener('mousemove', () =>{
		clearTimeout(hoverTimer)
	})
	document.body.addEventListener('mousemove', (mouseEvent) =>{
		hoverTimer = setTimeout(async () =>{
			//Get the element that was hover'd
			let hoveredElement = await document.elementFromPoint(mouseEvent.screenX, mouseEvent.screenY)
			let mousePos = [mouseEvent.screenX, mouseEvent.screenY]
			console.log(hoveredElement)
			//Prepare the element to have a hover box appear
			//ipc.send('wrapWords', [hoveredElement, mousePos, arg.length-1, document])
		}, 1000)
	})
	document.body.addEventListener('mouseout', () =>{
		clearTimeout(hoverTimer)
	})
})

