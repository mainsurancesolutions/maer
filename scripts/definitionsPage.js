const ipc = require('electron').ipcRenderer

/*
An array of arrays of [term, definition] for each doc
so [ [ [term, definition], [term, definition], [term, definition] ] , [ [term, definition], [term, definition], [term, definition] ], ...]
When displaying definitions, we will be showing the definitions from the most recent doc
*/
let allDefinitions

let position
let hoverTimer

//When initialized, populate the page with p tags containing terms and their definitions
ipc.on('loadDefinitions', (event, arg) =>{
	let defText
	let defNode
	for(let i = 0; i < arg[arg.length-1].length; i++){
		//Create the actual element
		defNode = document.createElement("p")
		//Add the text to the element
		defText = "\"" + arg[arg.length-1][i][0] + "\" " + arg[arg.length-1][i][1]
		defNode.appendChild(document.createTextNode(defText))
		document.body.appendChild(defNode)
	}
	
	document.body.addEventListener('mousemove', () =>{
		clearTimeout(hoverTimer)
	})
	document.body.addEventListener('mousemove', (mouseEvent) =>{
		hoverTimer = setTimeout(() =>{
			//Get the element that was hover'd
			let mousePos = [mouseEvent.screenX - position[0], mouseEvent.screenY - position[1]]
			let hoveredElement = document.elementFromPoint(mousePos[0], mousePos[1])
			console.log(hoveredElement)
			//Prepare the element to have a hover box appear
			//ipc.send('wrapWords', [hoveredElement, mousePos, arg.length-1, document])
		}, 1000)
	})
	document.body.addEventListener('mouseout', () =>{
		clearTimeout(hoverTimer)
	})
})

//Update the position variable when the window moves
ipc.on('position', (event, arg) =>{
	position = [arg[0], arg[1]]
})

