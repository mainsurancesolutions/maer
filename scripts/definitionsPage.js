const ipc = require('electron').ipcRenderer

/*
An array of arrays of [term, definition] for each doc
so [ [ [term, definition], [term, definition], [term, definition] ] , [ [term, definition], [term, definition], [term, definition] ], ...]
When displaying definitions, we will be showing the definitions from the most recent doc
*/
let allDefinitions

let mainDoc

let position
let hoverTimer
let lastMousePos
let lastElement

document.getElementById('minimize-button').addEventListener('click', () =>{
	ipc.send('minimizeDef')
})

document.getElementById('maximize-button').addEventListener('click', () =>{
	ipc.send('maximizeDef')
})

document.getElementById('close-button').addEventListener('click', () =>{
	ipc.send('closeDef')
})

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
		defNode.classList.add('definition')
		document.getElementById('definition-div').appendChild(defNode)
	}
	
	document.body.addEventListener('mousemove', () =>{
		clearTimeout(hoverTimer)
	})
	document.body.addEventListener('mousemove', (mouseEvent) =>{
		hoverTimer = setTimeout(() =>{
			//Get the element that was hover'd
			let mousePos = [mouseEvent.screenX - position[0], mouseEvent.screenY - position[1]]
			lastMousePos = mousePos
			let hoveredElement = document.elementFromPoint(mousePos[0], mousePos[1])
			console.log(hoveredElement.classList)
			console.log(hoveredElement.tagName)
			//Send hovered text to mainWindow.js in order to get the section text from there
			if(hoveredElement.classList.contains('definition') || hoveredElement.tagName === 'SPAN'){
				lastElement = hoveredElement
				ipc.send('getSection', [hoveredElement.innerText, mousePos, hoveredElement.tagName])
			}
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

//Once we've wrapped a paragraph in spans by hovering it, replace it with the wrapped version
ipc.on('re-hover', (event, arg) =>{
	console.log(arg)
	lastElement.innerHTML = arg
	let hoveredElement = document.elementFromPoint(lastMousePos[0], lastMousePos[1])
	console.log(hoveredElement.classList)
	console.log(hoveredElement.tagName)
	console.log(hoveredElement.innerText)
	//Now that we've wrapped it in spans, we should be hovering a span
	//So now we can actually tell which exact term we're hovering
	if(hoveredElement.classList.contains('definition') || hoveredElement.tagName === 'SPAN')
		ipc.send('getSection', [hoveredElement.innerText, lastMousePos, hoveredElement.tagName])
})

//When a definition is received
//The args received will be [position to put the popup, section number, section text]
ipc.on('sendSection', (event, arg) =>{
	console.log(arg)
})