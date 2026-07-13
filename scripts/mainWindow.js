let globalMaxW = 45
let globalMinW = 22

//Position of the window relative to the screen as a whole
let position = [0, 0]

//Console block div
let consoleBlock = document.getElementById('sidebar')

//The entire block divs for each doc
let docBlocks = document.getElementsByClassName('doc-block')

//The documents themselves, populated with input
let docs = [null, null]

//Template for a new doc block, inserted by docsFull() when adding versions.
//A function so ${docs.length} is evaluated at insertion time for correct version numbering.
function docBlockTemplate(){
  return `
  <div class="doc-block">
    <input hidden type="file" accept=".docx" onchange="fileAdded()"/>
    <div class="upload-card">
      <div class="upload-icon">📄</div>
      <p class="upload-label">Drop file ${docs.length} here</p>
      <button class="file-button nav-btn">Upload File</button>
      <input class="doc-title" onClick="this.select()" value=""
        onchange="nameChange()" placeholder="Version name...">
    </div>
    <p class="upload-text"></p>
    <button class="hide-button" style="display:none">✕ Hide</button>
    <p class="doc"></p>
  </div>
  <div class="expand" style="display:none"></div>`
}

/*
Array detailing which docs are shown. Used to know when re-comparing docs would change the results
Basically, when you compare, lastShown[] will show which docs were revealed last time you compared
currentlyShown[] is updated whenever a new doc is added or hidden. So if they differ, we know re-comparing would change things
The index for a given doc will be true if it was shown, false if it was hidden
*/
let lastShown = []
let currentlyShown = []

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

//We don't want any event to fire upon ending a drag
document.addEventListener('dragover', (event) =>{
	event.preventDefault();
	return false;
}, false);

//Dragging and dropping a .docx file onto the page
document.addEventListener('drop', (event) => {
  event.preventDefault()
  if(event.dataTransfer.files.length > 1){
    alert("You must upload 1 file at a time")
    return false
  }
  if(event.dataTransfer.files.length < 1)
    return false

  let inputFile = event.dataTransfer.files[0]
  if(!inputFile){
    alert("No file detected")
    return false
  }

  // Check if it's a .maer session file
  if(event.dataTransfer.files[0].name
    .toLowerCase().endsWith('.maer')){
    loadSession(event.dataTransfer.files[0])
    return false
  }

  if(!inputFile.name.toLowerCase().endsWith('.docx')){
    alert("You must upload a .docx file")
    return false
  }

  let filename = inputFile.name.replace(/\.docx$/i, '')

  let whichDoc = docs.indexOf(null)
  if(whichDoc === -1){
    docsFull()
    whichDoc = docs.length - 1
  }

  docBlocks[docBlocks.length-1].style.display = "inline-flex"
  docNicknames[whichDoc] = filename
  docs[whichDoc] = inputFile
  //Hide the upload card and show the filename, matching fileAdded()'s behaviour
  //(previously the card stayed visible above the dropped doc)
  let dropBlock = docBlocks[whichDoc]
  let uploadCard = dropBlock.querySelector('.upload-card')
  // Don't hide the card - just update it to show uploaded state
  if(uploadCard) {
    uploadCard.classList.add('uploaded')
    let uploadBtn = uploadCard.querySelector('.file-button')
    if(uploadBtn) {
      uploadBtn.disabled = true
      uploadBtn.style.opacity = '0.4'
      uploadBtn.style.cursor = 'default'
      uploadBtn.innerText = '✓ Uploaded'
    }
    let label = uploadCard.querySelector('.upload-label')
    if(label) label.innerText = filename
    let titleInput = uploadCard.querySelector('.doc-title')
    if(titleInput) titleInput.style.display = 'none'
    let uploadTextEl = dropBlock.querySelector('.upload-text')
    if(uploadTextEl) uploadTextEl.style.display = 'none'
  }
  currentlyShown[whichDoc] = true
  updateCompareButton()
  //If this drop filled a newly-added slot, the re-compare button is now showing
  if(document.getElementById('re-compare-button').style.display !== 'none'){
    showToast('Version added — click Re-Compare to update')
  }
  docsFull()
  return false
}, false)

//Close all pop-ups by clicking anywhere other than a button or the pop-up
document.addEventListener('click', () =>{
	if(event.target.tagName !== 'INPUT' && !event.target.classList.contains('popup')){
		//also account for the case in which the parent of what you clicked is the pop-up (ie text in the pop-up)
		if(event.target.parentElement){
			if(!event.target.parentElement.classList.contains('popup')){
				if(event.target.parentElement.parentElement){
					if(event.target.parentElement.parentElement.classList.contains('popup'))
						return
				}
				popups = document.getElementsByClassName('popup')
				for(let i = popups.length-1; i >= 0; i--){
					popups[i].parentElement.removeChild(popups[i])
				}
			}
		}
		else{
			popups = document.getElementsByClassName('popup')
			for(let i = popups.length-1; i >= 0; i--){
				popups[i].parentElement.removeChild(popups[i])
			}
		}
	}
})

//For resizing the document windows
const borderSize = 6
let mPos
let clickedDoc
let changingWidth = false
let firstResize = true

function rightExpand(e){
	if(firstResize){
		//Switch the panel from flex:1 to a fixed pixel width, otherwise flex:1
		//keeps overriding the width changes and the panel never actually resizes
		docBlocks[clickedDoc].style.flex = 'none'
		docBlocks[clickedDoc].style.width = docBlocks[clickedDoc].clientWidth + "px"
		firstResize = false
	}
	//A boolean value indicating that we are currently changing the width
	changingWidth = true
	//The difference between our current mouse position and our previous mouse position
	//Positive means we moved to the right, so expand
	const change = e.x - mPos
	mPos = e.x
	//Set the new width to be the old one + the change
	currWidth = (parseInt(getComputedStyle(docBlocks[clickedDoc], '').width) + change)
	globalMaxW = currWidth
	globalMinW = currWidth
	docBlocks[clickedDoc].style.flex = 'none'
	docBlocks[clickedDoc].style.width = currWidth + "px"
}

//Set all the doc widths to the same as the one you just changed
document.addEventListener("mouseup", () =>{
	document.removeEventListener("mousemove", rightExpand, false)
	if(changingWidth){
		changingWidth = false
		for(let i = 0; i < docBlocks.length; i++){
			//Don't resize hidden docs. Switch every visible panel from flex:1 to a
			//fixed pixel width so they all match the panel that was just resized.
			if(docBlocks[i].style.borderStyle !== "none"){
				docBlocks[i].style.flex = 'none'
				docBlocks[i].style.width = globalMaxW + "px"
			}
		}
	}
}, false)

//To add a new file after loading, simply un-hide the last one
//If there is no last one, add a new one
document.getElementById('add-button').addEventListener('click', () =>{
	try{
		//Use inline-flex (matching the .doc-block CSS) so a re-shown / added card
		//keeps the same column layout and width as the original two cards
		docBlocks[docBlocks.length-1].style.display= "inline-flex"
		let lastCard = docBlocks[docBlocks.length-1].querySelector('.upload-card')
		if(lastCard) lastCard.style.display = ''
		document.getElementsByClassName('file-button')[docBlocks.length-1].style.display= "inline-block"
	} catch{
		docsFull()
	}
	//Scroll the newly added/revealed panel into view (it may be off-screen right)
	setTimeout(() => {
		docBlocks[docBlocks.length-1].scrollIntoView({
			behavior: 'smooth',
			inline: 'end',
			block: 'nearest'
		})
	}, 50)
})

//Open a modal panel listing all definitions (browser replacement for the
//Electron definitions window)
document.getElementById('def-button').addEventListener('click', () => {
  let defModal = document.getElementById('def-modal')
  if(!defModal){
    defModal = document.createElement('div')
    defModal.id = 'def-modal'
    defModal.style.cssText = `
      position:fixed; top:0; right:0; width:35vw; height:100vh;
      background:white; border-left:2px solid #ccc;
      overflow-y:auto; z-index:1000; padding:20px;`
    let closeBtn = document.createElement('button')
    closeBtn.innerText = '✕ Close'
    //A clearly visible, full-width close button that sticks to the top of the
    //(scrollable) panel so it's always reachable
    closeBtn.style.cssText = `
      position: sticky;
      top: 0;
      margin-bottom: 15px;
      cursor: pointer;
      background: var(--navy);
      color: var(--gold);
      border: 1px solid var(--gold);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      width: 100%;
      z-index: 10;`
    closeBtn.addEventListener('click', () => {
      defModal.remove()
      let ov = document.getElementById('def-modal-overlay')
      if(ov) ov.remove()
    })
    defModal.appendChild(closeBtn)
    let title = document.createElement('h3')
    title.innerText = 'Definitions'
    defModal.appendChild(title)
    for(let i = 0; i < allDefinitions.length; i++){
      for(let j = 0; j < allDefinitions[i].length; j++){
        let p = document.createElement('p')
        p.classList.add('definitionItem')
        p.innerText = '"' + allDefinitions[i][j][0] + '" ' + allDefinitions[i][j][1]
        defModal.appendChild(p)
      }
    }
    //Enable the hover-to-define popups inside the definitions panel too, by
    //delegating from the modal to whichever .definitionItem is under the cursor
    //(mirrors the per-docSlot hover wiring in setUpScrollFunction)
    let defHoverTimer
    defModal.addEventListener('mousemove', (mouseEvent) => {
      clearTimeout(defHoverTimer)
      defHoverTimer = setTimeout(() => {
        let hoveredElement = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY)
        //Use closest() so hovering a child text node inside a .definitionItem still resolves it
        let defItem = hoveredElement ? hoveredElement.closest('.definitionItem') : null
        if(defItem){
          window.popupScript.wrapWords(defItem,
            [mouseEvent.clientX, mouseEvent.clientY], 0, document)
        }
      }, 1100)
    })
    defModal.addEventListener('mouseout', () => clearTimeout(defHoverTimer))
    //Semi-transparent overlay behind the modal; clicking it closes the panel.
    //(z-index 999 sits below the modal's inline z-index of 1000.)
    let overlay = document.createElement('div')
    overlay.id = 'def-modal-overlay'
    overlay.style.cssText = `
      position: fixed; top:0; left:0; right:0; bottom:0;
      background: rgba(0,0,0,0.3); z-index: 999;`
    overlay.addEventListener('click', () => {
      defModal.remove()
      overlay.remove()
    })
    document.body.appendChild(overlay)
    document.body.appendChild(defModal)
  } else {
    defModal.remove()
    let ov = document.getElementById('def-modal-overlay')
    if(ov) ov.remove()
  }
})

//The main comparison function. Runs when the 'compare' button is pressed
//Read and render all non-hidden documents
document.getElementById('compare-button').addEventListener('click', async () =>{
	let shownDocs = []
	let shownSlots = []
	//Find out which docs are hidden
	for(let i = 0; i < docs.length; i++){
		console.log('Compare loop slot', i,
			'docs[i]:', !!docs[i],
			'docTitleSlots[i]:', !!docTitleSlots[i],
			'uploadTextSlots[i]:', !!uploadTextSlots[i],
			'docSlots[i]:', !!docSlots[i])
		if(docSlots[i] && docSlots[i].style.display !== "none"){
			shownDocs.push(docs[i])
			shownSlots.push(docSlots[i])
		}
	}
	//At LEAST 2 docs have to be filled
	if(shownDocs.filter(d => d !== null).length < 2){
		alert("You must compare at least 2 documents")
		return false
	}
	if(await render(shownDocs, shownSlots, document.getElementById('table-of-contents')) === false){
		alert("Upload failed. If you moved the documents since last time you opened them, you'll have to start a new project.")
	}
	//Hide every empty/unused doc-block and any leftover upload card, so a
	//(re-)comparison never re-surfaces upload UI for already-populated documents.
	//(Previously only the single last slot was hidden, which let upload cards
	//reappear on re-compare.)
	for(let i = 0; i < docBlocks.length; i++){
		if(docs[i] === null || docs[i] === undefined){
			docBlocks[i].style.display = "none"
		} else {
			let card = docBlocks[i].querySelector('.upload-card')
			if(card) card.style.display = 'none'
		}
	}
	//Show the sidebar (table of contents)
	consoleBlock.style.display= "inline-block"
	document.getElementById('sidebar').style.display = 'flex'
	//Phase 2: reveal the AI Analysis toggle once a comparison is on screen
	document.getElementById('ai-toggle-btn').style.display = 'inline-block'
	document.getElementById('restart-btn').style.display = 'inline-block'
	document.getElementById('save-session-btn').style.display = 'inline-block'
	//Hide the upload instructions so only the documents show
	let uploadInstructions = document.getElementById('upload-instructions')
	if(uploadInstructions) uploadInstructions.style.display = 'none'
	//Hide the upload-screen-only right column (Load Session + sample); the
	//.comparing CSS also collapses the two-column wrappers so #docs goes full width
	let uploadRight = document.getElementById('upload-right')
	if(uploadRight) uploadRight.style.display = 'none'
	//Switch the layout into side-by-side comparison mode
	document.getElementById('docs-area').classList.add('comparing')
	document.getElementById('upload-zone').style.flexDirection = 'row'
	document.getElementById('upload-zone').style.alignItems = 'flex-start'
	document.getElementById('upload-zone').style.justifyContent = 'flex-start'
	document.getElementById('upload-zone').style.padding = '0'
	document.getElementById('upload-zone').style.overflow = 'hidden'
	document.getElementById('upload-zone').style.height = '100%'
	//Show the hide/unhide button for every filled panel, and size the visible
	//doc-blocks. A collapsed panel (currentlyShown === false) must be LEFT as its
	//64px strip — re-compare previously reset it to flex:1, expanding it back to a
	//full-width empty panel and stranding the Unhide button.
	for(let i = 0; i < docBlocks.length; i++){
		if(docs[i]){
			if(hideButtons[i]) hideButtons[i].style.display = "inline-block"
			if(currentlyShown[i] !== false){
				docBlocks[i].style.height = '100%'
				docBlocks[i].style.flex = '1'
			}
		}
	}
	//Change doc titles
	for(let i = 0; i < docBlocks.length; i++){
		if(docs[i]){
			if(docTitleSlots[i]) {
				docTitleSlots[i].style.display = "inline-block"
				docTitleSlots[i].value = docNicknames[i] || ''
			}
			if(uploadTextSlots[i]) {
				uploadTextSlots[i].innerHTML = ""
			}
		}
	}
	//Add a sticky version header to each visible document panel
	for(let i = 0; i < docBlocks.length; i++){
		if(docs[i]){
			let existingHeader = docBlocks[i].querySelector('.doc-version-header')
			if(!existingHeader){
				let header = document.createElement('div')
				header.className = 'doc-version-header'
				//Title lives in its own span (not a bare text node) so the collapsed
				//64px strip can hide it via CSS while keeping the Unhide button reachable.
				let versionName = document.createElement('span')
				versionName.className = 'version-name'
				versionName.innerText = docNicknames[i] || 'Version ' + (i+1)
				header.appendChild(versionName)
				//Print button in the ribbon — opens a clean, print-formatted copy of
				//just this version (redlines preserved) in a new tab + print dialog
				let printBtn = document.createElement('button')
				printBtn.className = 'print-version-btn'
				printBtn.innerHTML = '⎙ Print'
				printBtn.title = 'Print this version'
				printBtn.addEventListener('click', (e) => {
					e.stopPropagation()
					let docClone = docBlocks[i].querySelector('.doc').cloneNode(true)
					//Remove every injected control. comparison.js only adds inline <input class="hide-*">
					//+ <button class="reveal-text">; source contracts have no native form controls, so
					//stripping all input/button is safe and catches anything the class list might miss.
					docClone.querySelectorAll('input, button, .hide-article, .hide-paragraphs, .hide-section, .reveal-text').forEach(el => el.remove())
					//The ONLY hiding mechanism comparison.js uses is inline style.display="none" (both the
					//diff unchanged-paragraph hide AND the collapse handlers). Clear it on EVERY descendant
					//unconditionally so the full document prints.
					docClone.querySelectorAll('*').forEach(el => { el.style.display = '' })
					let docContent = docClone.innerHTML
					let docName = docNicknames[i] || 'Version ' + (i+1)
					let printWindow = window.open('', '_blank')
					printWindow.document.write(`
						<html>
							<head>
								<title>${docName}</title>
								<style>
									body { font-family: Georgia, serif; padding: 40px; }
									h1 { font-size: 14px; text-transform: uppercase; }
									h2 { font-size: 13px; }
									p { font-size: 12px; line-height: 1.6; }
									ins { background: #c8e9d1; color: #0d5c2e; text-decoration: none; }
									del { background: #fce8e6; color: #c5221f; text-decoration: line-through; }
								</style>
							</head>
							<body>
								<h1>${docName}</h1>
								${docContent}
							</body>
						</html>
					`)
					printWindow.document.close()
					printWindow.print()
				})
				header.appendChild(printBtn)
				//Move the Hide button out of the scrolling doc-block and into the
				//sticky header so it stays visible no matter how far the panel scrolls.
				//The click listener is attached to the element itself (see the hide
				//loop below), so it survives this DOM move intact.
				let hideBtn = docBlocks[i].querySelector('.hide-button')
				if(hideBtn){
					hideBtn.style.position = 'relative'
					hideBtn.style.top = 'auto'
					hideBtn.style.right = 'auto'
					hideBtn.style.display = 'inline-block'
					header.appendChild(hideBtn)
				}
				docBlocks[i].insertBefore(header, docBlocks[i].querySelector('.doc'))
			}
		}
	}
	//Reveal add button
	document.getElementById('add-button').style.display= "inline-block"

	lastShown = currentlyShown.slice(0)
	updateCompareButton()
	//Implement the ability to click on a section and have all docs scroll to it
	setUpScrollFunction()
})

async function setUpScrollFunction(){
	//Need to wait for the table of contents to be generated before setting this up
	function ensureListIsGenerated() {
	    return new Promise(function (resolve, reject) {
	        (function waitForListItems(){
	            if (document.getElementsByTagName('LI')[1] && docSlots[0].textContent !== "Processing...")
	            	return resolve()
	            setTimeout(waitForListItems, 130)
	        })()
	    })
	}

	ensureListIsGenerated().then(function(){
		//First set up section searching from table of contents
		let listItems = document.getElementsByTagName('LI')
		for(let i = 0; i < listItems.length; i++){
			listItems[i].addEventListener('click', ()=>{findSection(listItems[i])})
		}
		//then set up searching for matching paragraphs by clicking on a
		//paragraph in a doc
		let paragraphs
		for(let i = 0; i < docSlots.length; i++){
			paragraphs = docSlots[i].getElementsByTagName('P')
			//Put a click event on each paragraph indicating which doc its from
			for(let j = 0; j < paragraphs.length; j++){
				paragraphs[j].addEventListener('click', (e)=>{
					findParagraphs(i, e.target)
					//Phase 2: also trigger AI analysis if the AI panel is open
					let aiPanel = document.getElementById('ai-panel')
					if(aiPanel && aiPanel.style.display !== 'none'){
						analyzeClause(e.target)
					}
				})
			}
			//Also create an event on each header to scroll to it in others when clicked
			h1s = docSlots[i].getElementsByTagName('H1')
			h2s = docSlots[i].getElementsByTagName('H2')
			for(let j = 0; j < h1s.length; j++){
				h1s[j].addEventListener('click', ()=>{findSection(event.target)})
			}
			for(let j = 0; j < h2s.length; j++){
				h2s[j].addEventListener('click', ()=>{findSection(event.target)})
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
				//Collapse/expand only — don't bubble to the <li>'s scroll-to-section handler
				event.stopPropagation()
				for(let j = allSections.indexOf(articles[i]) + 1; j < allSections.length; j++){
					//If we've reached the next section, stop hiding/showing
					if(allSections[j].classList.contains("section")){
						break
					}
					if(allSections[j].style.display !== "none"){
						allSections[j].style.display = "none"
						articleHideButtons[i].value = "▶"
					}
					else{
						allSections[j].style.display = ""
						articleHideButtons[i].value = "▼"
					}
				}
			})
			//If the section has changes, the subsections should start visible
			if(articles[i].classList.contains('changed')){
				//First change the button to reflect that the subsections are visible
				articleHideButtons[i].value = "▼"
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
		//Tell the popup script where the browser window sits on screen so it can
		//convert screen coordinates to client coordinates
		popupScript.setPosition([window.screenX, window.screenY])
		/*
		Start watching for mouse hovers
		The way this works is, when you move your mouse in a doc, it starts counting down a timer
		Moving your mouse again or scrolling will reset the timer
		If the timer reaches zero (so if you move your mouse into a doc and then dont move again),
		it will call the popupScript to generate a popup
		If you move your mouse off of the doc, it will cancel the timer
		This is also set up in the popups themselves, allowing you to hover terms in them
		*/
		for(let i = 0; i < docSlots.length-1; i++){
			docSlots[i].addEventListener('mousemove', () =>{
				clearTimeout(hoverTimer)
			})
			docBlocks[i].addEventListener('scroll', () =>{
				clearTimeout(hoverTimer)
			})
			docSlots[i].addEventListener('mousemove', (mouseEvent) => {
				clearTimeout(hoverTimer)
				hoverTimer = setTimeout(() => {
					let rect = docBlocks[i].getBoundingClientRect()
					let mousePos = [
						mouseEvent.clientX,
						mouseEvent.clientY
					]
					let hoveredElement = document.elementFromPoint(mousePos[0], mousePos[1])
					if(hoveredElement && !hoveredElement.classList.contains('doc'))
						window.popupScript.wrapWords(hoveredElement, mousePos, i, document)
				}, 1100)
			})
			docSlots[i].addEventListener('mouseout', () =>{
				clearTimeout(hoverTimer)
			})
		}

		//Add listeners to each 'expand' button to allow resizing
		let expandButtons = document.getElementsByClassName('expand')
		for(let i = 0; i < expandButtons.length; i++){
			//Hide the expand button if the docblock itself is hidden
			if(docBlocks[i].style.display === "none"){
				expandButtons[i].style.display = "none"
			}
			else{
				expandButtons[i].style.display = ""
				expandButtons[i].addEventListener("mousedown", (e) =>{
					mPos = e.x
					clickedDoc = i
					document.addEventListener("mousemove", rightExpand, false)
				}, false)
			}
		}
	})
}

//When you click on a section in the table of contents,
//scroll all docs to that section
function findSection(section){
	scrollScript.findSection(section, docSlots, docBlocks)
}

//When you click a paragraph, scroll all docs to that paragraph
function findParagraphs(whichDoc, paragraph){
	scrollScript.findMatchingParagraphs(paragraph, whichDoc, docSlots, docBlocks)
}

//Hide a doc
for(let i = 0; i < 2; i++){
	hideButtons[i].addEventListener('click', () =>{
		if(docSlots[i].style.display === "none"){
			//Show: restore the panel to its full comparison width
			currentlyShown[i] = true
			docSlots[i].style.display = "inline-block"
			hideButtons[i].innerText = '✕ Hide'
			docBlocks[i].style.flex = '1'
			docBlocks[i].style.width = ''
			docBlocks[i].style.minWidth = '320px'
			docBlocks[i].style.padding = '0 20px 32px'
			docBlocks[i].classList.remove('panel-collapsed')
			let existingLabel = docBlocks[i].querySelector('.collapsed-label')
			if(existingLabel) existingLabel.remove()
		}
		//Hide: collapse to a narrow ~64px strip showing just the "Unhide" button
		else{
			currentlyShown[i] = false
			docSlots[i].style.display = "none"
			hideButtons[i].innerText = 'Unhide'
			docBlocks[i].style.flex = 'none'
			docBlocks[i].style.width = '64px'
			docBlocks[i].style.minWidth = '64px'
			docBlocks[i].style.padding = '8px 4px'
			docBlocks[i].classList.add('panel-collapsed')
			//Vertical document-name label so the collapsed strip is identifiable
			let collapsedLabel = document.createElement('div')
			collapsedLabel.className = 'collapsed-label'
			collapsedLabel.innerText = docNicknames[i] || 'Version ' + (i+1)
			docBlocks[i].appendChild(collapsedLabel)
		}
		updateCompareButton()
	})
}

//Collapse / expand the sidebar to a thin strip via the arrow button in its
//header (standard sidebar pattern, replacing the old X + top-bar Contents button)
let sidebarCollapsed = false
document.getElementById('sidebar-collapse-btn').addEventListener('click', () => {
	let sidebar = document.getElementById('sidebar')
	sidebarCollapsed = !sidebarCollapsed
	if(sidebarCollapsed){
		sidebar.classList.add('collapsed')
		document.getElementById('sidebar-collapse-btn').innerText = '›'
	} else {
		sidebar.classList.remove('collapsed')
		document.getElementById('sidebar-collapse-btn').innerText = '‹'
	}
})

//Restart / new session button — reloads the page after confirmation
document.getElementById('restart-btn').addEventListener('click', async () => {
	let hasDocs = docs.some(d => d !== null)
	if(hasDocs) {
		let choice = confirm(
			'Save your current session before starting over?\n\n' +
			'Click OK to save first, or Cancel to discard and restart.')
		if(choice) {
			await saveSession()
			setTimeout(() => window.location.reload(), 1000)
			return
		}
	}
	window.location.reload()
})

//The image button that activates the input field to upload files
let inputFileButtons = document.getElementsByClassName('file-button')

for(let i = 0; i < 2; i++){
	inputFileButtons[i].addEventListener('click', () => {
		event.target.closest('.doc-block').querySelector('input[type="file"]').click()
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
	if(!inputFile){
		alert("No file detected")
		return false
	}

	//Find out which slot the doc was added to
	let whichDoc = -1
	for(let i = 0; i < docBlocks.length; i++){
		if(docBlocks[i] === buttonParent)
			whichDoc = i
	}
	if(whichDoc === -1)
		throw "Could not find out which slot the file belongs to"

	//Use the standard File.name to validate and extract the filename
	if(!inputFile.name.toLowerCase().endsWith('.docx')){
		alert("You must upload a .docx file")
		return false
	}
	let filename = inputFile.name.replace(/\.docx$/i, '')
	docNicknames[whichDoc] = filename

	//Store the doc and change the title
	docs[whichDoc] = inputFile

	//Hide the upload card now that a file has been picked, and show the filename
	let uploadCard = event.target.closest('.doc-block').querySelector('.upload-card')
	// Don't hide the card - just update it to show uploaded state
	if(uploadCard) {
		uploadCard.classList.add('uploaded')
		let uploadBtn = uploadCard.querySelector('.file-button')
		if(uploadBtn) {
			uploadBtn.disabled = true
			uploadBtn.style.opacity = '0.4'
			uploadBtn.style.cursor = 'default'
			uploadBtn.innerText = '✓ Uploaded'
		}
		let label = uploadCard.querySelector('.upload-label')
		if(label) label.innerText = filename
		let titleInput = uploadCard.querySelector('.doc-title')
		if(titleInput) titleInput.style.display = 'none'
		let uploadText = docBlocks[whichDoc].querySelector('.upload-text')
		if(uploadText) uploadText.style.display = 'none'
	}
	currentlyShown[whichDoc] = true
	updateCompareButton()
	//If this upload filled a newly-added slot, the re-compare button is now
	//showing — nudge the user to re-run the comparison
	if(document.getElementById('re-compare-button').style.display !== 'none'){
		showToast('Version added — click Re-Compare to update')
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
	document.getElementById('docs').insertAdjacentHTML('beforeend', docBlockTemplate())
	docBlocks = document.getElementsByClassName('doc-block')
	docSlots = document.getElementsByClassName('doc')
	docTitleSlots = document.getElementsByClassName('doc-title')
	uploadTextSlots = document.getElementsByClassName('upload-text')
	docNicknames.push(null)

	//Activate buttons in new docBlock
	let inputFileButtons = document.getElementsByClassName('file-button')
	inputFileButtons[docNumber-1].addEventListener('click', () => {
		event.target.closest('.doc-block').querySelector('input[type="file"]').click()
	})

	let hideButtons = document.getElementsByClassName('hide-button')
	hideButtons[docNumber-1].addEventListener('click', () => {
		if(docSlots[docNumber-1].style.display === "none"){
			//Show: restore the panel to its full comparison width
			currentlyShown[docNumber-1] = true
			docSlots[docNumber-1].style.display = "inline-block"
			hideButtons[docNumber-1].innerText = '✕ Hide'
			docBlocks[docNumber-1].style.flex = '1'
			docBlocks[docNumber-1].style.width = ''
			docBlocks[docNumber-1].style.minWidth = '320px'
			docBlocks[docNumber-1].style.padding = '0 20px 32px'
			docBlocks[docNumber-1].classList.remove('panel-collapsed')
			let existingLabel = docBlocks[docNumber-1].querySelector('.collapsed-label')
			if(existingLabel) existingLabel.remove()
		}
		//Hide: collapse to a narrow ~64px strip showing just the "Unhide" button
		else{
			currentlyShown[docNumber-1] = false
			docSlots[docNumber-1].style.display = "none"
			hideButtons[docNumber-1].innerText = 'Unhide'
			docBlocks[docNumber-1].style.flex = 'none'
			docBlocks[docNumber-1].style.width = '64px'
			docBlocks[docNumber-1].style.minWidth = '64px'
			docBlocks[docNumber-1].style.padding = '8px 4px'
			docBlocks[docNumber-1].classList.add('panel-collapsed')
			//Vertical document-name label so the collapsed strip is identifiable
			let collapsedLabel = document.createElement('div')
			collapsedLabel.className = 'collapsed-label'
			collapsedLabel.innerText = docNicknames[docNumber-1] || 'Version ' + docNumber
			docBlocks[docNumber-1].appendChild(collapsedLabel)
		}
		updateCompareButton()
	})
}

//Whenever we show, hide, or add a doc, we want to update the compare button 
//to reflect if a re-comparison would change things
function updateCompareButton(){
	compareButton = document.getElementById('compare-button')
	recompareButton = document.getElementById('re-compare-button')
	if(arraysEqual(lastShown, currentlyShown) || lastShown.length === 0){
		compareButton.style.display = "block"
		recompareButton.style.display = "none"
	}
	else{
		compareButton.style.display = "none"
		recompareButton.style.display = "block"
	}
}

//The re-compare button simply clicks the main compare button
document.getElementById('re-compare-button').addEventListener('click', () =>{
	document.getElementById('compare-button').click()
})

//Brief toast notification at the bottom of the screen
function showToast(message){
	let existing = document.getElementById('toast')
	if(existing) existing.remove()
	let toast = document.createElement('div')
	toast.id = 'toast'
	toast.innerText = message
	toast.style.cssText = `
		position: fixed;
		bottom: 40px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--navy);
		color: var(--gold);
		padding: 10px 24px;
		border-radius: 20px;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.5px;
		z-index: 1000;
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		transition: opacity 0.4s;
	`
	document.body.appendChild(toast)
	setTimeout(() => { toast.style.opacity = '0' }, 1800)
	setTimeout(() => { toast.remove() }, 2200)
}

//Buy-side / sell-side toggle in the top bar
document.getElementById('buyside-btn').addEventListener('click', () => {
	document.getElementById('buyside-btn').classList.add('active')
	document.getElementById('sellside-btn').classList.remove('active')
	window.negotiationSide = 'buyside'
	showToast('Buy-Side mode active')
	//Phase 2: reflect the active side in the AI panel
	document.getElementById('ai-mode-indicator').innerText = '⚡ Buy-Side AI'
	document.getElementById('ai-mode-badge').innerText = 'Buy-Side Mode'
})

document.getElementById('sellside-btn').addEventListener('click', () => {
	document.getElementById('sellside-btn').classList.add('active')
	document.getElementById('buyside-btn').classList.remove('active')
	window.negotiationSide = 'sellside'
	showToast('Sell-Side mode active')
	//Phase 2: reflect the active side in the AI panel
	document.getElementById('ai-mode-indicator').innerText = '⚡ Sell-Side AI'
	document.getElementById('ai-mode-badge').innerText = 'Sell-Side Mode'
})

window.negotiationSide = 'buyside'

//Checks the equivalence of two arrays
function arraysEqual(arr1, arr2) {
    if(arr1.length !== arr2.length)
        return false;
    for(let i = arr1.length; i--;) {
        if(arr1[i] !== arr2[i])
            return false;
    }
    return true;
}

//Built-in sample-agreement demo: fetches the bundled .docx versions from the
//server, loads them into doc slots as if the user had uploaded them, and kicks
//off a comparison automatically — so prospects can see the tool work without
//uploading their own confidential documents.
document.getElementById('load-sample-btn')
  .addEventListener('click', async () => {
    try {
      let btn = document.getElementById('load-sample-btn')
      btn.innerText = 'Loading sample...'
      btn.disabled = true

      let res = await fetch('/api/sample-files')
      let data = await res.json()

      if(!data.files || data.files.length < 2){
        alert('Sample files not found. Please upload your own files.')
        btn.innerText = 'Try with sample agreement (4 versions)'
        btn.disabled = false
        return
      }

      // Fetch each file and convert to File objects
      let fileObjects = []
      for(let i = 0; i < data.files.length; i++){
        let fileRes = await fetch(data.files[i])
        let blob = await fileRes.blob()
        let filename = data.files[i].split('/').pop()
        let fileObj = new File([blob], filename,
          {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
        fileObjects.push(fileObj)
      }

      // Ensure enough doc slots exist
      for(let i = 2; i < fileObjects.length; i++){
        docsFull(true)
      }

      // Load files into slots
      for(let i = 0; i < fileObjects.length; i++){
        docs[i] = fileObjects[i]
        let filename = fileObjects[i].name.replace(/\.docx$/i, '')
        docNicknames[i] = filename
        currentlyShown[i] = true
        let uploadCard = docBlocks[i].querySelector('.upload-card')
        if(uploadCard) uploadCard.style.display = 'none'
        let uploadText = docBlocks[i].querySelector('.upload-text')
        if(uploadText) uploadText.innerHTML = filename +
          ' loaded successfully'
      }

      // The comparison pipeline (readDocs) converts files.length - 1 docs, treating the last
      // slot as the trailing EMPTY placeholder the normal upload flow always leaves behind
      // (docsFull() adds an empty slot after every upload). The sample flow fills every slot
      // exactly, so WITHOUT a trailing empty slot the last version is dropped from conversion
      // and its panel renders empty. Add the trailing empty slot to restore that invariant.
      docsFull()

      updateCompareButton()

      // Hide the upload-only sample option
      let sampleArea = document.getElementById('sample-area')
      if(sampleArea) sampleArea.style.display = 'none'

      // Auto-click compare
      document.getElementById('compare-button').click()

    } catch(err) {
      console.error('Sample load error:', err)
      alert('Could not load sample files: ' + err.message)
      let btn = document.getElementById('load-sample-btn')
      btn.innerText = 'Try with sample agreement (4 versions)'
      btn.disabled = false
    }
  })

// ── Phase 2: clause analysis (calls the server /api/analyze-clause endpoint) ──
async function analyzeClause(paragraphElement){
  let clone = paragraphElement.cloneNode(true)
  clone.querySelectorAll('del').forEach(el => el.remove())
  clone.querySelectorAll('input, button, .hide-article, .hide-paragraphs, .hide-section, .reveal-text').forEach(el => el.remove())
  let clauseText = (clone.innerText || clone.textContent || '').trim()
  clauseText = clauseText.replace(/^(ARTICLE\s+\d+\s+|[\d]+\.[\d]+\s+)/, '')
  if(clauseText.length < 20) return

  let prevSelected = document.querySelector('p.ai-selected')
  if(prevSelected) prevSelected.classList.remove('ai-selected')
  paragraphElement.classList.add('ai-selected')

  let aiPanel = document.getElementById('ai-panel')
  let aiToggleBtn = document.getElementById('ai-toggle-btn')
  aiPanel.style.display = 'flex'
  aiToggleBtn.classList.add('active')
  let docsEl = document.getElementById('docs')
  if(docsEl) docsEl.scrollLeft = docsEl.scrollWidth

  document.getElementById('ai-welcome-state').style.display = 'none'
  document.getElementById('ai-loading-state').style.display = 'flex'
  document.getElementById('ai-result-state').style.display = 'none'
  document.getElementById('ai-error-state').style.display = 'none'

  // Collect clause history across all versions
  let clauseHistory = []
  for(let i = 0; i < docSlots.length; i++){
    if(!docs[i] || !docSlots[i] ||
       !docSlots[i].childNodes.length) continue
    let paragraphs = Array.from(
      docSlots[i].getElementsByTagName('p'))
    let validTexts = paragraphs.map(p => {
      let c = p.cloneNode(true)
      c.querySelectorAll('del').forEach(el => el.remove())
      c.querySelectorAll('input,button').forEach(
        el => el.remove())
      return (c.innerText || c.textContent || '').trim()
    }).filter(t => t.length > 20)
    if(validTexts.length === 0) continue
    try {
      let result = stringSimilarity.findBestMatch(
        clauseText, validTexts)
      if(result.bestMatch.rating > 0.3){
        clauseHistory.push({
          version: i + 1,
          versionName: docNicknames[i] ||
            'Version ' + (i + 1),
          text: result.bestMatch.target,
          similarity: result.bestMatch.rating
        })
      }
    } catch(e) {}
  }
  clauseHistory.sort((a, b) => a.version - b.version)

  let totalVersions = docs.filter(d => d !== null).length

  try {
    let response = await fetch('/api/analyze-clause', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        clauseText: clauseText,
        negotiationSide: window.negotiationSide || 'buyside',
        clauseHistory: clauseHistory,
        totalVersions: totalVersions
      })
    })
    if(!response.ok) throw new Error(
      'Server returned ' + response.status)
    let data = await response.json()
    if(data.error) throw new Error(data.error)
    displayAnalysis(data.analysis, clauseText)
    if(data.versionsAnalyzed > 1){
      let side = window.negotiationSide === 'sellside' ?
        'Sell-Side' : 'Buy-Side'
      document.getElementById('ai-mode-indicator')
        .innerText = '⚡ ' + side + ' AI · ' +
        data.versionsAnalyzed + ' versions analyzed'
    }
  } catch(err) {
    console.error('AI analysis error:', err)
    document.getElementById('ai-loading-state')
      .style.display = 'none'
    document.getElementById('ai-error-state')
      .style.display = 'flex'
    document.getElementById('ai-error-message')
      .innerText = err.message ||
        'Analysis failed. Please try again.'
  }
}

// Strip preamble / wrapping quotes / asterisks Claude sometimes adds around the
// suggested language, so the copied text is only the contract language itself.
function cleanSuggestedLanguage(text){
  // Remove preamble up to and including a colon
  // e.g. "Add the following after the second sentence:"
  text = text.replace(/^[^“”"\*]*[:]\s*/s, '')

  // Remove surrounding asterisks and smart/regular quotes
  text = text.replace(/^\*+[“”"]?\s*/, '')
  text = text.replace(/\s*[“”"]\*+$/, '')
  text = text.replace(/^[“”"]\s*/, '')
  text = text.replace(/\s*[“”"]$/, '')

  // Also clean asterisk-wrapped italic markdown
  text = text.replace(/^\*([^*]+)\*$/, '$1')

  return text.trim()
}

function displayAnalysis(analysisText, clauseText){
  // Hide loading, show result
  document.getElementById('ai-loading-state').style.display
    = 'none'
  document.getElementById('ai-result-state').style.display
    = 'flex'

  // Show the clause text
  let displayText = clauseText.length > 200
    ? clauseText.substring(0, 200) + '...'
    : clauseText
  document.getElementById('ai-clause-text').innerText =
    '"' + displayText + '"'

  // Parse the four sections from Claude's response
  let analysisHtml = ''
  let suggestedContent = null // raw SUGGESTED LANGUAGE text; cleaned into the copy node below

  // Split by the bold headers Claude uses
  let sections = analysisText.split(/\*\*([^*]+)\*\*/)

  // sections will be: ['', 'HEADER1', 'content1',
  //   'HEADER2', 'content2', ...]
  for(let i = 1; i < sections.length; i += 2){
    let header = sections[i].trim()
    let content = sections[i+1] ? sections[i+1].trim() : ''

    if(header === 'SUGGESTED LANGUAGE' ||
       header === 'RECOMMENDED NEXT POSITION'){
      analysisHtml += '<h4>' + header + '</h4>'
      // Generate a visual redline diff between the original clause and the suggestion
      let diffed = htmldiff(
        '<span>' + clauseText + '</span>',
        '<span>' + content + '</span>'
      )
      analysisHtml += '<div class="suggested-language suggested-diff">' +
        diffed + '</div>'
      // Hidden clean copy of the suggested language so the Copy button grabs the
      // final text only — not the struck-through deletions in the diff, and not
      // any preamble/quotes/asterisks (set as innerText after render, below).
      suggestedContent = content
      analysisHtml += '<div class="suggested-clean" style="display:none"></div>'
      analysisHtml += '<button class="copy-btn" onclick="' +
        'navigator.clipboard.writeText(' +
        'this.previousElementSibling.innerText)' +
        '.then(()=>{ this.innerText=\'Copied!\'; ' +
        'setTimeout(()=>this.innerText=\'Copy language\',2000)})"' +
        '>Copy language</button>'
    } else {
      analysisHtml += '<h4>' + header + '</h4>'
      analysisHtml += '<p>' + content + '</p>'
    }
  }

  if(!analysisHtml){
    // Fallback if parsing fails - show raw text
    analysisHtml = '<p>' + analysisText.replace(
      /\n/g, '</p><p>') + '</p>'
  }

  // Convert markdown strikethrough ~~text~~ to <del>
  analysisHtml = analysisHtml.replace(
    /~~([^~]+)~~/g, '<del>$1</del>')

  // Convert markdown bold **text** to <strong>
  analysisHtml = analysisHtml.replace(
    /\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  document.getElementById('ai-analysis').innerHTML =
    analysisHtml

  // Populate the hidden copy node as plain text, stripped of preamble/quotes/
  // asterisks, so "Copy language" yields only the final contract language.
  if(suggestedContent !== null){
    let cleanDiv = document.querySelector('#ai-analysis .suggested-clean')
    if(cleanDiv) cleanDiv.innerText = cleanSuggestedLanguage(suggestedContent)
  }
}

// Wire up the retry button
document.getElementById('ai-retry-btn')
  .addEventListener('click', () => {
    let selected = document.querySelector('p.ai-selected')
    if(selected) analyzeClause(selected)
  })

// SAVE SESSION
async function saveSession() {
  try {
    // Build session object
    let sessionDocs = []
    for(let i = 0; i < docs.length; i++) {
      if(docs[i] === null) continue
      // Read file as base64
      let arrayBuffer = await docs[i].arrayBuffer()
      let uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      uint8.forEach(b => binary += String.fromCharCode(b))
      let base64 = btoa(binary)
      sessionDocs.push({
        name: docNicknames[i] || 'Version ' + (i+1),
        filename: docs[i].name,
        data: base64
      })
    }

    if(sessionDocs.length === 0) {
      alert('No documents to save.')
      return
    }

    let session = {
      version: '2.0',
      saved: new Date().toISOString(),
      app: 'ContractsCompare',
      documents: sessionDocs
    }

    // Serialize + build a descriptive filename
    let json = JSON.stringify(session)
    let firstName = (docNicknames[0] || 'session')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30)
    let dateStr = new Date().toISOString()
      .substring(0,10)

    // Try File System Access API first (Chrome/Edge)
    // This shows a real "Save As" dialog
    if(window.showSaveFilePicker) {
      try {
        let fileHandle = await window.showSaveFilePicker({
          suggestedName: 'CC_' + firstName + '_' +
            dateStr + '.maer',
          types: [{
            description: 'ContractsCompare Session',
            accept: {'application/json': ['.maer']}
          }]
        })
        let writable = await fileHandle.createWritable()
        await writable.write(json)
        await writable.close()
        showToast('Session saved successfully')
        return
      } catch(e) {
        // User cancelled or API failed
        if(e.name === 'AbortError') return
        // Fall through to download method
      }
    }

    // Fallback: automatic download to Downloads folder
    // (Safari, Firefox, older browsers)
    let blob = new Blob([json], {type: 'application/json'})
    let url = URL.createObjectURL(blob)
    let a = document.createElement('a')
    a.href = url
    a.download = 'CC_' + firstName + '_' +
      dateStr + '.maer'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Saved to Downloads: CC_' +
      firstName + '_' + dateStr + '.maer')
  } catch(err) {
    console.error('Save error:', err)
    alert('Save failed: ' + err.message)
  }
}

// LOAD SESSION
async function loadSession(file) {
  try {
    let text = await file.text()
    let session = JSON.parse(text)

    if(!session.documents ||
       session.documents.length === 0) {
      alert('Invalid session file.')
      return
    }

    if(session.app !== 'ContractsCompare') {
      alert('This file was not created by ContractsCompare.')
      return
    }

    showToast('Loading session...')

    let needed = session.documents.length

    // STEP 1: Reset docs array to correct size
    // Fill with nulls up to needed count
    docs = new Array(needed).fill(null)
    docNicknames = new Array(needed).fill(null)
    currentlyShown = new Array(needed).fill(false)

    // STEP 2: Create DOM slots
    // We always start with 2 slots in HTML; create additional ones needed.
    // NOTE: the block MUST include .doc-title and .upload-text — the compare
    // loop indexes docTitleSlots[i]/uploadTextSlots[i] in parallel with
    // docBlocks, so omitting them misaligns the collections and throws mid-compare.
    let extraNeeded = Math.max(0, needed - 2)
    for(let i = 0; i < extraNeeded; i++) {
      let newBlock = document.createElement('div')
      newBlock.className = 'doc-block'
      newBlock.innerHTML = `
        <input hidden type="file" accept=".docx"
          onchange="fileAdded()"/>
        <div class="upload-card uploaded">
          <div class="upload-icon">📄</div>
          <p class="upload-label">Loading...</p>
          <button class="file-button nav-btn"
            disabled style="opacity:0.4">
            ✓ Uploaded
          </button>
          <input class="doc-title" onClick="this.select()"
            value="" onchange="nameChange()"
            placeholder="Version name..." style="display:none">
        </div>
        <p class="upload-text"></p>
        <button class="hide-button"
          style="display:none">✕ Hide</button>
        <p class="doc"></p>`
      document.getElementById('docs')
        .appendChild(newBlock)
    }

    // STEP 3: Wait for DOM to fully render
    await new Promise(r => setTimeout(r, 200))

    // STEP 4: Refresh ALL live collections
    docBlocks = document.getElementsByClassName('doc-block')
    docSlots = document.getElementsByClassName('doc')
    docTitleSlots = document.getElementsByClassName('doc-title')
    uploadTextSlots = document.getElementsByClassName('upload-text')

    console.log('After DOM creation:',
      'docBlocks:', docBlocks.length,
      'needed:', needed)

    // STEP 5: Populate each slot
    for(let i = 0; i < needed; i++) {
      let docData = session.documents[i]

      // Convert base64 to File
      let binary = atob(docData.data)
      let bytes = new Uint8Array(binary.length)
      for(let j = 0; j < binary.length; j++) {
        bytes[j] = binary.charCodeAt(j)
      }
      let blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-' +
          'officedocument.wordprocessingml.document'
      })
      let fileObj = new File([blob], docData.filename,
        {type: blob.type})

      docs[i] = fileObj
      docNicknames[i] = docData.name
      currentlyShown[i] = true

      // Update card UI
      let block = docBlocks[i]
      if(block) {
        let card = block.querySelector('.upload-card')
        if(card) {
          card.classList.add('uploaded')
          let lbl = card.querySelector('.upload-label')
          if(lbl) lbl.innerText = docData.name
          let btn = card.querySelector('.file-button')
          if(btn) {
            btn.disabled = true
            btn.style.opacity = '0.4'
            btn.innerText = '✓ Uploaded'
          }
        }
        // Make block visible
        block.style.display = 'inline-flex'
      }

      console.log('Slot', i, 'set:',
        docData.name, 'block:', !!block)
    }

    // STEP 6: Hide session UI
    let loadArea = document.getElementById(
      'load-session-area')
    if(loadArea) loadArea.style.display = 'none'
    let orDiv = document.getElementById(
      'upload-or-divider')
    if(orDiv) orDiv.style.display = 'none'
    let sampleArea = document.getElementById(
      'sample-area')
    if(sampleArea) sampleArea.style.display = 'none'

    // STEP 7: Trigger compare
    updateCompareButton()

    console.log('Final docs:',
      docs.map((d,i) => i + ':' + (d?.name || 'null')))

    showToast('Session loaded — comparing...')
    setTimeout(() => {
      document.getElementById('compare-button').click()
    }, 500)

  } catch(err) {
    console.error('Load session error:', err)
    alert('Could not load session: ' + err.message)
  }
}

// Wire up buttons
document.getElementById('save-session-btn')
  .addEventListener('click', saveSession)

document.getElementById('load-session-input')
  .addEventListener('change', (e) => {
    if(e.target.files[0]) {
      loadSession(e.target.files[0])
      e.target.value = '' // reset so same file can reload
    }
  })

// ── Phase 2: AI Panel controls (UI shell only — no Claude API calls yet) ──
document.getElementById('ai-toggle-btn')
  .addEventListener('click', () => {
    let panel = document.getElementById('ai-panel')
    let btn = document.getElementById('ai-toggle-btn')
    if(panel.style.display === 'none' ||
       panel.style.display === ''){
      panel.style.display = 'flex'
      btn.classList.add('active')
      // Scroll the document row to the far right so the AI panel column is visible
      setTimeout(() => {
        let docsEl = document.getElementById('docs')
        if(docsEl) docsEl.scrollLeft = docsEl.scrollWidth
      }, 50)
    } else {
      panel.style.display = 'none'
      btn.classList.remove('active')
    }
  })

document.getElementById('ai-panel-close')
  .addEventListener('click', () => {
    document.getElementById('ai-panel').style.display = 'none'
    document.getElementById('ai-toggle-btn')
      .classList.remove('active')
  })