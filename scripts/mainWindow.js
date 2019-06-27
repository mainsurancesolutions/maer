const ipc = require('electron').ipcRenderer
const fs = require('fs')
const compareScript = require('.\\scripts\\comparison.js')
const saveScript = require('.\\scripts\\saveManager.js')
const scrollScript = require('.\\scripts\\scroll.js')
const popupScript = require('.\\scripts\\popup.js')

let docBlockHTML = fs.readFileSync('docBlock.html')

//Console block div
let consoleBlock = document.getElementById('console-block')

//The entire block divs for each doc
let docBlocks = document.getElementsByClassName('doc-block')

//The documents themselves, populated with input
let docs = [null, null]

//The empty <p> tags where the documents will be rendered
let docSlots = document.getElementsByClassName('doc')

//Title slots for each doc
let docTitleSlots = document.getElementsByClassName('doc-title')

//"Upload a file" text
let uploadTextSlots = document.getElementsByClassName('upload-text')

let docNicknames = [null, null]

let allDefinitions = []
let hoverTimer

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

//To add a new file after loading, simply un-hide the last one
//If there is no last one, add a new one
document.getElementById('add-button').addEventListener('click', () =>{
	try{
		docBlocks[docBlocks.length-1].style.display= "inline-block"
		document.getElementsByClassName('file-button')[docBlocks.length-1].style.display= "inline-block"
	} catch{
		docsFull()
	}
})

//The save project button
document.getElementById('save-button').addEventListener('click', () => {
	//Pass the save request to the main process to get the path
	ipc.send('save')
})

//Edit button, opens last doc in default application for the user
document.getElementById('edit-button').addEventListener('click', () =>{
	//find the rightmost doc to edit
	if(docs[docBlocks.length-1] !== null)
		ipc.send('edit', docs[docBlocks.length-1].path)
	else
		ipc.send('edit', docs[docBlocks.length-2].path)
})

//Once we get the path from the main process, we can pass it to the saveScript to save it
ipc.on('savePath', (event, arg) =>{
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
	await new Promise((resolve) => {setTimeout(resolve, 10)});

	//Force the creation of new doc slots if needed
	for(let i = 2; i < project[0].length; i++){
		docsFull(true)
	}
	docs = project[0]
	docNicknames = project[1];

	//Basically do the processes as if we just uploaded the files
	let fileButtons = document.getElementsByClassName('file-button')
	for(let j = 0; j < project[0].length; j++){
		//First hide the file upload buttons
		fileButtons[j].style.display= "none"
		//Then show doc titles
		docTitleSlots[j].innerHTML = docNicknames[j]
	}

	//Now compare
	document.getElementById('compare-button').click()
})

//Read and render all non-hidden documents
document.getElementById('compare-button').addEventListener('click', () =>{
	let shownDocs = []
	let shownSlots = []
	//Find out which docs are hidden
	for(let i = 0; i < docs.length; i++){
		if(docSlots[i].style.display !== "none"){
			shownDocs.push(docs[i])
			shownSlots.push(docSlots[i])
		}
	}
	console.log(shownDocs)
	//At LEAST the first 2 docs have to be filled
	if(shownDocs.length < 2){
		alert("You must compare at least 2 documents")
		return false
	}
	compareScript.render(shownDocs, shownSlots, document.getElementById('table-of-contents'))
	//Hide the last unused slot
	if(docs[docBlocks.length-1] === null)
		docBlocks[docBlocks.length-1].style.display= "none"
	//Show console
	consoleBlock.style.display= "inline-block"
	document.getElementById('edit-button').style.display= "inline-block"
	//Show 'hide' buttons
	for(let i = 0; i < docBlocks.length; i++)
		hideButtons[i].style.display = "inline-block"
	//Show 'save' button and hide 'load' button
	document.getElementById('save-button').style.display= "inline-block"
	document.getElementById('load-button').style.display= "none"
	//Change doc titles
	for(let i = 0; i < docBlocks.length; i++){
		docTitleSlots[i].style.display = "inline-block"
		docTitleSlots[i].value = docNicknames[i]
		uploadTextSlots[i].innerHTML = ""
	}
	//Reveal add button
	document.getElementById('add-button').style.display= "inline-block"
	//Implement the ability to click on a section and have all docs scroll to it
	setUpScrollFunction()
})

async function setUpScrollFunction(){
	//Need to wait for the table of contents to be generated before setting this up
	function ensureListIsGenerated() {
	    return new Promise(function (resolve, reject) {
	        (function waitForListItems(){
	            if (document.getElementsByTagName('LI')[1] !== undefined) return resolve()
	            setTimeout(waitForListItems, 5000)
	        })()
	    })
	}

	ensureListIsGenerated().then(function(){
		//First set up section searching from table of contents
		let listItems = document.getElementsByTagName('LI')
		for(let i = 0; i < listItems.length; i++){
			listItems[i].addEventListener('click', function(){findSection(i)})
		}
		//then set up searching for matching paragraphs by clicking on a
		//paragraph in a doc
		let paragraphs
		for(let i = 0; i < docSlots.length; i++){
			paragraphs = docSlots[i].getElementsByTagName("P")
			//Put a click event on each paragraph indicating which doc its from
			for(let j = 0; j < paragraphs.length; j++){
				paragraphs[j].addEventListener('click', ()=>{findParagraphs(i, event.target)})
			}
		}
		//The following code sets up the feature to hide elements in the *table of contents*
		//with the arrow buttons
		let articles = document.getElementsByClassName("section")
		let allSections = Array.from(consoleBlock.getElementsByTagName('LI'))
		let articleHideButtons = document.getElementsByClassName("hide-section")
		//Go through all the sections and assign them which subsections to hide when clicked
		for(let i = 0; i < articleHideButtons.length; i++){
			//Find where the button was pressed, then hide all subsections after that
			//If already hidden, do the opposite
			articleHideButtons[i].addEventListener('click', ()=>{
				for(let j = allSections.indexOf(articles[i]) + 1; j < allSections.length; j++){
					//If we've reached the next section, stop hiding/showing
					if(allSections[j].classList.contains("section")){
						break
					}
					if(allSections[j].style.display !== "none"){
						allSections[j].style.display = "none"
						articleHideButtons[i].src = "images/showSection.png"
					}
					else{
						allSections[j].style.display = ""
						articleHideButtons[i].src = "images/hideSection.png"
					}
				}
			})
			//If the section has changes, the subsections should start visible
			if(articles[i].classList.contains('changed')){
				//First change the button to reflect that the subsections are visible
				articleHideButtons[i].src = "images/hideSection.png"
				//Then actually show the subsections
				for(let j = allSections.indexOf(articles[i]) + 1; j < allSections.length; j++){
					if(allSections[j].classList.contains("section")){
						break
					}
					allSections[j].style.display = ""
				}
			}
		}
		//Also generate the definitions
		allDefinitions = popupScript.getDefs(docSlots)
		//Start watching for mouse hovers
		for(let i = 0; i < docSlots.length-1; i++){
			docSlots[i].addEventListener('mousemove', () =>{
				clearTimeout(hoverTimer)
			})
			docSlots[i].addEventListener('mousemove', (mouseEvent) =>{
				hoverTimer = setTimeout(() =>{
					//Get the element that was hover'd
					let hoveredElement = document.elementFromPoint(mouseEvent.screenX, mouseEvent.screenY)
					let mousePos = [mouseEvent.screenX, mouseEvent.screenY]
					//Prepare the element to have a hover box appear
					popupScript.wrapWords(hoveredElement, mousePos, i, document)
				}, 1700)
			})
			docSlots[i].addEventListener('mouseout', () =>{
				clearTimeout(hoverTimer)
			})
		}
	})
}

//When you click on a section in the table of contents,
//scroll all docs to that section
function findSection(section){
	let listItems = document.getElementsByTagName('LI')
	scrollScript.findSection(listItems[section], docSlots, docBlocks)
}

//When you click a paragraph, scroll all docs to that paragraph
function findParagraphs(whichDoc, paragraph){
	scrollScript.findMatchingParagraphs(paragraph, whichDoc, docSlots, docBlocks)
}

//Hide a doc
for(let i = 0; i < 2; i++){
	hideButtons[i].addEventListener('click', () => {
		//If it's not hidden, hide it. Otherwise, display it
		if(docSlots[i].style.display !== "none"){
			docSlots[i].style.display = "none"
			docBlocks[i].style.minWidth = "80px"
			docBlocks[i].style.maxWidth = "80px"
			//Move title to the left so it can be seen while hidden
			document.getElementsByClassName('doc-title')[i].style.textAlign = "left"
		}
		else{
			docSlots[i].style.display = "inline-block"
			docBlocks[i].style.minWidth = "20vw"
			docBlocks[i].style.maxWidth = "45vw"
			document.getElementsByClassName('doc-title')[i].style.textAlign = "center"
		}
	})
}

//Hide console
document.getElementById('hide-console').addEventListener('click', () =>{
	tableOfContents = document.getElementById('table-of-contents')
	if(tableOfContents.style.display === "none"){
		tableOfContents.style.display = "inline-block"
		consoleBlock.style.minWidth = "15vw"
		consoleBlock.style.maxWidth = "20vw"
	}
	else{
		tableOfContents.style.display = "none"
		consoleBlock.style.minWidth = "84px"
		consoleBlock.style.maxWidth = "84px"
	}
})

//The image button that activates the input field to upload files
let inputFileButtons = document.getElementsByClassName('file-button')

for(let i = 0; i < 2; i++){
	inputFileButtons[i].addEventListener('click', () => {
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})
}

//Triggered when a doc name is changed
function nameChange(){
	//Find out which block the nickname belongs to
	let nameChangedBlock = event.target.parentElement
	for(let i = 0; i < docBlocks.length; i++){
		if(docBlocks[i] === nameChangedBlock)
			docNicknames[i] = event.target.value
	}
}

//Triggered upon a file being uploaded
function fileAdded(){
	let buttonParent = event.target.parentElement
	let children = event.target.parentElement.childNodes

	//First get the file from the input that triggered the event
	let inputFile = event.target.files[0]

	//Find out which slot the doc was added to
	let whichDoc = -1
	for(let i = 0; i < docBlocks.length; i++){
		if(docBlocks[i] === buttonParent)
			whichDoc = i
	}
	if(whichDoc === -1)
		throw "Could not find out which slot the file belongs to"

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
			children[i].style.display = "none"
		}
	}
	//Check if all docs are full
	docsFull()
}

//Check if all slots are full and a new one must be made
//If so, do so and update certain variables
//Force will make it create a new slot no matter what
function docsFull(force = false){
	if(!force){
		for(let i = 0; i < docs.length; i++){
		//If there's an empty slot left, no need to add a new one
		if(docs[i] === null)
			return
		}
	}
	
	//Update the arrays containing all docs/elements from all docs
	docs.push(null)
	let docNumber = docs.length
	docBlocks[docBlocks.length-1].insertAdjacentHTML('afterend', docBlockHTML)
	docBlocks = document.getElementsByClassName('doc-block')
	docSlots = document.getElementsByClassName('doc')
	docTitleSlots = document.getElementsByClassName('doc-title')
	uploadTextSlots = document.getElementsByClassName('upload-text')
	docNicknames.push(null)

	//Activate buttons in new docBlock
	let inputFileButtons = document.getElementsByClassName('file-button')
	inputFileButtons[docNumber-1].addEventListener('click', () => {
		let buttonParent = event.target.parentElement
		buttonParent.childNodes[1].click()
	})

	let hideButtons = document.getElementsByClassName('hide-button')
	hideButtons[docNumber-1].addEventListener('click', () => {
		//If it's not hidden, hide it. Otherwise, display it
		if(docSlots[docNumber-1].style.display !== "none"){
			docBlocks[docNumber-1].style.minWidth = "80px"
			docBlocks[docNumber-1].style.maxWidth = "80px"
			docSlots[docNumber-1].style.display = "none"
			//Move title to the left so it can be seen while hidden
			document.getElementsByClassName('doc-title')[docNumber-1].style.textAlign = "left"
		}
		else{
			docSlots[docNumber-1].style.display = "inline-block"
			docBlocks[docNumber-1].style.minWidth = "20vw"
			docBlocks[docNumber-1].style.maxWidth = "45vw"
			document.getElementsByClassName('doc-title')[docNumber-1].style.textAlign = "center"
		}
	})
}