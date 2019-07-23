const ipc = require('electron').ipcRenderer
const fs = require('fs')
const popupHTML = fs.readFileSync('definitionPopup.html')

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
		defNode.classList.add('definitionItem')
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
			//Send hovered text to mainWindow.js in order to get the section text from there
			if(hoveredElement.classList.contains('definitionItem') || hoveredElement.tagName === 'SPAN'){
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
	lastElement.innerHTML = arg
	let hoveredElement = document.elementFromPoint(lastMousePos[0], lastMousePos[1])
	//Now that we've wrapped it in spans, we should be hovering a span
	//So now we can actually tell which exact term we're hovering
	if(hoveredElement.classList.contains('definitionItem') || hoveredElement.tagName === 'SPAN')
		ipc.send('getSection', [hoveredElement.innerText, lastMousePos, hoveredElement.tagName])
})

//When a definition/section is hovered, create a pop-up box to show it
//The args received will be [term, definition, z level]
ipc.on('sendSection', (event, arg) =>{
	let popupElement = document.createElement('div')
	popupElement.innerHTML = popupHTML
	document.body.appendChild(popupElement)
	//Position the element where you hovered
	//We set the top and right so we can easily detect if the element is offscreen
	popupElement.style.left = lastMousePos[0] + "px"
	popupElement.style.top = lastMousePos[1] + "px"

	popupElement.classList.add("popup")
	popupElement.getElementsByClassName('close-popup-button')[0].addEventListener('click', ()=>{
		popupElement.parentElement.removeChild(popupElement)
		//We also want it to reset the 'hover' timer when you close a popup
		clearTimeout(hoverTimer)
	})
	popupElement.getElementsByClassName('term')[0].innerHTML = arg[0]
	popupElement.getElementsByClassName('definition')[0].innerHTML = arg[1]
	popupElement.style.zIndex = arg[2]

	//Implement the 'hover' function on the popup box itself, allowing recursive boxes
	let hoverTimer
	popupElement.addEventListener('mousemove', () =>{
		clearTimeout(hoverTimer)
	})
	popupElement.addEventListener('mousemove', (mouseEvent) =>{
		hoverTimer = setTimeout(() =>{
			//Get the element that was hover'd
			let mousePos = [mouseEvent.screenX - position[0], mouseEvent.screenY - position[1]]
			lastMousePos = mousePos
			let hoveredElement = document.elementFromPoint(mousePos[0], mousePos[1])
			//Send hovered text to mainWindow.js in order to get the section text from there
			if(hoveredElement.classList.contains('definitionItem') || hoveredElement.tagName === 'SPAN'){
				lastElement = hoveredElement
				ipc.send('getSection', [hoveredElement.innerText, mousePos, hoveredElement.tagName])
			}
		}, 1000)
	})
	popupElement.addEventListener('mouseout', () =>{
		clearTimeout(hoverTimer)
	})
	//Bring the popup to the front upon click
	popupElement.addEventListener('click', () =>{
		popupElement.style.zIndex = arg[2]
		arg[2]++
	})
	//Remove the 'zoom to section' button, since we're on the definitions page
	popupElement.removeChild(popupElement.getElementsByClassName('zoom-button')[0])
	//if it's a section/article, we wanna remove the "collapse section" buttons
	if(arg[0].split(" ")[0] === "Section" || arg[0].split(" ")[0] === "Article"){
		let lineBreak = document.createElement("br")
		//replace each "collapse section" button with a simple linebreak
		let inputTags = popupElement.getElementsByClassName('definition')[0].getElementsByTagName('INPUT')
		//We have to start from the last button and work backwards, as when we remove a button it will shift
		//the positions of all others in the list. Removing from behind avoids this issue
		for(let i = inputTags.length - 1; i >= 0; i--){
			popupElement.getElementsByClassName('definition')[0].replaceChild(lineBreak.cloneNode(true), inputTags[i])
		}
	}
})