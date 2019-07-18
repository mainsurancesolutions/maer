const popupHTML = fs.readFileSync('definitionPopup.html')
const scrollScript = require('..\\scripts\\scroll.js')
//Each pop-up will have a z index ensuring they appear above everything else
//we increment that counter with each new popup so that if you have multiple popups,
//the most recent will show up in front of all others
let zCounter = 2
let position

module.exports ={

	setPosition: function(pos){
		position = pos
	},
	
	//Populate the allDefinitions array with tuples of terms and their definitions
	getDefs: function(docSlots){
		let allDefinitions = []
		/*
		Create an array of arrays of [term, definition] for each doc
		so [ [ [term, definition], [term, definition], [term, definition] ] , [ [term, definition], [term, definition], [term, definition] ], ...]
		*/
		for(let i = 0; i < docSlots.length-1; i++){
			let docTermsAndDefs = []
			//Get an array of all the paragraphs in the 'Definitions' section
			//Find the 'definitions' header element
			let headers = docSlots[i].getElementsByTagName('H2')
			let definitionsHeader
			//Definitions is usually at the end, so we can save time by starting there
			for(let j = headers.length-1; j > 0; j--){
				if(headers[j].textContent.includes("Definitions"))
					definitionsHeader = headers[j]
			}
			//Now we find the header index in the nodes of the doc, and start gather definitions
			//in that section
			let textNodes = Array.from(docSlots[i].childNodes)
			//To be populated as [term, definition]
			for(let j = textNodes.indexOf(definitionsHeader)+1; j < textNodes.length; j++){
				let termAndDef = [null, null]
				//Skip the paragraph if it doesn't begin with a term in quotations
				if(textNodes[j].textContent[0] === "\""){
					if(textNodes[j].tagName !== "P")
						break
					termAndDef[0] = textNodes[j].textContent.split("\"")[1]
					termAndDef[1] = textNodes[j].textContent.substring(termAndDef[0].length+3)
					docTermsAndDefs.push(termAndDef)
				}
			}
			allDefinitions.push(docTermsAndDefs)
		}
		//Reveal the 'Definitions' button
		docSlots[0].ownerDocument.getElementById('def-button').style.display = "block"
		return allDefinitions
	},

	/*
	Triggered upon hovering a word
	Splits the paragraph into 'words', wrapping each term in a <span>
	then find the exact span that was hover'd in order to find the word we want
	*/
	wrapWords: function(hoveredElement, mousePos, docNumber, document){
		let paragraph
		switch(hoveredElement.tagName){
			case 'INS':
				paragraph = hoveredElement.parentElement
				break
			case 'DEL':
				paragraph = hoveredElement.parentElement
				break
			case 'P':
				paragraph = hoveredElement
				//In case they hover a gap in the doc, and it attempts to wrap the *entire doc*
				//We don't want it to do that!
				if(hoveredElement.classList.contains('doc'))
					return
				break
			case 'SPAN':
				//This will happen if the paragraph has been hovered once before
				//in which case it's already prepared to be sent off
				if(hoveredElement.innerText.length < 30){
					//Hovered a definition
					if(hoveredElement.innerText.trim().split(' ')[0] !== "Section" && hoveredElement.innerText.trim().split(' ')[0] !== "Article")
						return hoverDef(allDefinitions, hoveredElement.innerText, mousePos, docSlots, docNumber)
					//Hovered an article or section
					else
						return hoverSection(hoveredElement.innerText.trim(), mousePos, docSlots, docNumber)
				}
				else
					return
			default:
				return
		}
		//Split the paragraph into words and wrap them in spans
		let splitParagraph = paragraph.innerHTML.split(" ")
		let reconstructed = ""
		let inATag = null
		for(let i = 0; i < splitParagraph.length; i++){
			//We don't wanna insert <span> tags in the middle of existing tags
			if(splitParagraph[i].includes('<') || splitParagraph[i].includes('>')){
				inATag = true
			}
			else{
				if(splitParagraph[i+1] !== undefined){
					//This catches cases like if we're looking at the word 'hidden' in <ins hidden class="changed">
					//Iterate through the letters of the words to our right. If we find a > before we find a <, we know we're in a tag
					for(let j = i+1; j < splitParagraph.length; j++){
						for(let k = 0; k < splitParagraph[j].length; k++){
							if(splitParagraph[j][k] === '<'){
								inATag = false
								break
							}
							else if(splitParagraph[j][k] === '>'){
								inATag = true
								break
							}
						}
						//If we definitively know if we're in a tag or not, there's
						//no need to keep checking words to our right
						if(inATag !== null)
							break
					}
				}
			}
			//If we're not in a tag, wrap the current word in a span
			if(inATag !== true){
				//Additionally, if the text is in quotations, keep the quote together
				//This will make it possible to get the definitions of things like "Tax Returns", which is multiple words
				if(splitParagraph[i][0] === '\"' && splitParagraph[i][splitParagraph[i].length-1] !== '\"' && i === 0){
					reconstructed += '<span>' + splitParagraph[i] + " "
					let k = i+1
					while(splitParagraph[k] !== undefined){
						i++
						reconstructed += splitParagraph[k] + " "
						if(splitParagraph[k][splitParagraph[k].length-1] === "\"")
							break
						k++
					}
					reconstructed += "</span> "
				}
				//If the word is "Section", we wanna wrap it with the section number
				//BUT make sure the word directly after the section isnt a tag
				//ie watch out for cases like "Section <a id="DocXTextRef67"></a> 210"
				else if(splitParagraph[i].trim() === "Section" || splitParagraph[i].trim() === "Article"){
					if(!splitParagraph[i+1].includes('<')){
						reconstructed += '<span>' + splitParagraph[i] + " " + splitParagraph[i+1] + '</span> '
						i++
					}
					else
						reconstructed += '<span>' + splitParagraph[i] + '</span> '
				}
				else
					reconstructed += '<span>' + splitParagraph[i] + '</span> '
			}
			else
				reconstructed += splitParagraph[i] + " "
			inATag = null
		}
		paragraph.innerHTML = reconstructed
		//Now that we've split the paragraph, check the hover'd element once again
		let hoveredWord = document.elementFromPoint(mousePos[0], mousePos[1]).innerText
		//Make sure we're not grabbing the entire paragraph
		if(hoveredWord.length < 30){
			//Hovered a definition
			if(hoveredWord.trim().split(' ')[0] !== "Section" && hoveredWord.trim().split(' ')[0] !== "Article")
				hoverDef(allDefinitions, hoveredWord, mousePos, docSlots, docNumber)
			//Hovered an article or section
			else
				hoverSection(hoveredWord.trim(), mousePos, docSlots, docNumber)
		}
	}
}

//Creates the popup after hovering a term/section name
//section is the header of the found section, for use when scrolling to it
function popup(term, definition, mousePos, document, docNumber, section){
	let popupElement = document.createElement('div')
	popupElement.innerHTML = popupHTML
	console.log(popupElement)
	console.log(document.getElementById('docs-and-console'))
	if(document.getElementById('docs-and-console'))
		document.getElementById('docs-and-console').appendChild(popupElement)
	else
		document.body.appendChild(popupElement)
	//Position the element where you hovered
	//We set the top and right so we can easily detect if the element is offscreen
	popupElement.style.left = mousePos[0] + "px"
	popupElement.style.top = mousePos[1] + "px"

	popupElement.classList.add("popup")
	popupElement.getElementsByClassName('close-popup-button')[0].addEventListener('click', ()=>{
		popupElement.parentElement.removeChild(popupElement)
		//We also want it to reset the 'hover' timer when you close a popup
		clearTimeout(hoverTimer)
	})
	popupElement.getElementsByClassName('term')[0].innerHTML = term
	popupElement.getElementsByClassName('definition')[0].innerHTML = definition
	popupElement.style.zIndex = zCounter
	zCounter++

	//Implement the 'hover' function on the popup box itself, allowing recursive boxes
	let hoverTimer
	popupElement.addEventListener('mousemove', () =>{
		clearTimeout(hoverTimer)
	})
	popupElement.addEventListener('mousemove', (mouseEvent) =>{
		hoverTimer = setTimeout(() =>{
			//Get the element that was hover'd
			//Note that screenX is the coordinates on the entire screen, so we need to take into account the
			//case in which the window is not fullscreened
			//We cannot simply use pageX instead of screenX, as that messes up when you scroll the window
			let mousePosNew = [mouseEvent.screenX - position[0], mouseEvent.screenY - position[1]]
			let hoveredElement = document.elementFromPoint(mousePosNew[0], mousePosNew[1])
			
			//Prepare the element to have a hover box appear
			popupScript.wrapWords(hoveredElement, mousePosNew, docNumber, document)
		}, 1000)
	})
	popupElement.addEventListener('mouseout', () =>{
		clearTimeout(hoverTimer)
	})
	//Bring the popup to the front upon click
	popupElement.addEventListener('click', () =>{
		popupElement.style.zIndex = zCounter
		zCounter++
	})
	//Zoom the doc to that section upon clicking the arrow button
	popupElement.getElementsByClassName('zoom-button')[0].addEventListener('click', () =>{
		scrollScript.scrollTo(document.getElementsByClassName('doc-block')[docNumber], section)
	})
	//Remove the 'zoom to section' button if this is a definition
	//if it's a section/article, we wanna remove the "collapse section" buttons
	if(term.split(" ")[0] !== "Section" && term.split(" ")[0] !== "Article")
		popupElement.removeChild(popupElement.getElementsByClassName('zoom-button')[0])
	else{
		let lineBreak = document.createElement("br")
		//replace each "collapse section" button with a simple linebreak
		let inputTags = popupElement.getElementsByClassName('definition')[0].getElementsByTagName('INPUT')
		//We have to start from the last button and work backwards, as when we remove a button it will shift
		//the positions of all others in the list. Removing from behind avoids this issue
		for(let i = inputTags.length - 1; i >= 0; i--){
			popupElement.getElementsByClassName('definition')[0].replaceChild(lineBreak.cloneNode(true), inputTags[i])
		}
	}


	/*
	Make sure the window is onscreen fully
	The style.top, style.bottom, etc. are stored as "#px". So we must remove the px
	We also don't want the popup to be on the title bar, which is 48px in height
	It is worth noting that the origin point is the lower left of the popup, which is why we need the offset for 
	setting the right and top boundaries
	Another effect of the origin being the lower left is we never have to worry about the element going off the bottom or left
	*/
	if((popupElement.style.top.slice(0, -2))-popupElement.offsetHeight < 48)
		popupElement.style.top = (popupElement.offsetHeight + 48) + "px"
	//The location of the right side of the element
	let elementRight = document.body.clientWidth - popupElement.style.left.slice(0, -2) - popupElement.offsetWidth
	if(elementRight < 0){
		popupElement.style.left = (document.body.clientWidth - popupElement.offsetWidth) + "px"
		popupElement.style.right = popupElement.offsetWidth + "px"
	}
}

/*
Triggered upon hovering over a term, after the paragraph has been wrapped in spans.
If you hover over long enough, the definition of that term will appear
along with buttons to scroll to it
allDefinitions: detailed by the getDefs function, where it is created
We want to give the user the definition as it is defined in the current document
If the definition is not present in the given document, see if it's in the others, starting with the most recent doc
*/
function hoverDef(allDefinitions, hoveredWord, mousePos, docSlots, docNumber){
	//Remember that allDefinitions[docNumber] is the array of [term, definition] for the given doc
	//We'll populate this with all of the terms from the current doc, then compare the hovered word to them
	//to find the closest match
	let definition
	/*
	We will extract from the definitions array the following:
	[any term that has the hovered word as a substring, the index of said term]
	We will then take the longest substring, and get the definition from that
	*/
	//First trim the end of the term if it's a period or comma
	if(hoveredWord.substring(hoveredWord.length-1) === "," || hoveredWord.substring(hoveredWord.length-1) === "." || hoveredWord.substring(hoveredWord.length-1) === "\"" || hoveredWord.substring(hoveredWord.length-1) === ":" || hoveredWord.substring(hoveredWord.length-1) === ";")
		hoveredWord = hoveredWord.trim().substring(0, hoveredWord.length-1)
	if(hoveredWord[0] === "\"")
		hoveredWord = hoveredWord.substring(1)
	let docTerms = []
	for(let i = 0; i < allDefinitions[docNumber].length; i++){
		if(allDefinitions[docNumber][i][0].includes(hoveredWord)){
			docTerms.push([allDefinitions[docNumber][i][0], i])
		}
	}
	//In case we don't find it there, we also check the most recent doc and compare
	let lastDocTerms = []
	for(let i = 0; i < allDefinitions[docSlots.length-2].length; i++){
		if(allDefinitions[docSlots.length-2][i][0].includes(hoveredWord)){
			lastDocTerms.push([allDefinitions[docSlots.length-2][i][0], i])
		}
	}
	//If there's no matches in either, we're done here
	if(docTerms.length === 0 && lastDocTerms.length === 0){
		return popup(hoveredWord, "No match found", mousePos, docSlots[0].ownerDocument, docNumber)
	}
	//If there's only 1 match, we can use that
	if(docTerms.length === 1 && lastDocTerms.length === 0)
		return popup(hoveredWord, allDefinitions[docNumber][docTerms[0][1]][1], mousePos, docSlots[0].ownerDocument, docNumber)
	else if(docTerms.length === 0 && lastDocTerms === 1)
		return popup(hoveredWord, allDefinitions[docSlots.length-2][lastDocTerms[0][1]][1], mousePos, docSlots[0].ownerDocument, docNumber)		//If we reach here, both docs contain multiple matches for the definition
	//Now find the shortest term containing the substring (We don't wanna return the definition of 'tax returns' when they hover 'tax')
	let shortest = docTerms[0][0].length
	let shortestIndex = 0
	for(let i = 0; i < docTerms.length; i++){
		if(docTerms[i][0].length < shortest){
			shortest = docTerms[i][0].length
			shortestIndex = i
		}
	}
	let shortestLast = lastDocTerms[0][0].length
	let shortestIndexLast = 0
	for(let i = 0; i < lastDocTerms.length; i++){
		if(lastDocTerms[i][0].length < shortestLast){
			shortestLast = lastDocTerms[i][0].length
			shortestIndexLast = i
		}
	}
	//Now that we've found the shortest match, find it in the allDefinitions array and show that to the user
	if(shortest <= shortestLast)
		definition = allDefinitions[docNumber][docTerms[shortestIndex][1]]
	else
		definition = allDefinitions[docSlots.length-2][lastDocTerms[shortestIndexLast][1]]
	popup(definition[0], definition[1], mousePos, docSlots[0].ownerDocument, docNumber)
}


//When you hover a section number long enough, have a popup appear with a link to that section
function hoverSection(section, mousePos, docSlots, docNumber){
	let document = docSlots[0].ownerDocument
	let docChildren = docSlots[docNumber].childNodes
	let sectionText = ""
	let sectionNum
	let sectionIndex
	let sectionHeader
	//If we hovered a section
	if(section.split(' ')[0] === "Section"){
		//Some section links will be written like "2.02(a)(ii)"
		//We only want the 2.02 part, which is what 'trimmedSection' will be
		sectionNum = section.split(' ')[1].split("(")[0]
		//Now search each subsection to find the number
		h2s = docSlots[docNumber].getElementsByTagName('H2')
		for(let i = 0; i < h2s.length; i++){
			if(h2s[i].textContent.includes(sectionNum)){
				sectionHeader = h2s[i]
				//Once we find the section, we wanna fetch the paragraphs from that section
				sectionIndex = Array.from(docChildren).indexOf(h2s[i])
				for(let j = sectionIndex+1; j < docChildren.length; j++){
					if(docChildren[j].tagName === "H1" || docChildren[j].tagName === "H2")
						break
					else
						sectionText += docChildren[j].innerHTML
				}
				sectionNum = "Section " + sectionNum
				break
			}
		}
	}
	//Works pretty much the same as when fetching a section
	else if(section.split(' ')[0] === "Article"){
		//Convert the article number to an integer
		sectionNum = romanToArabic(section.split(' ')[1])
		h1s = docSlots[docNumber].getElementsByTagName('H1')
		for(let i = 0; i < h1s.length; i++){
			if(h1s[i].textContent.includes(" " + sectionNum + " ")){
				sectionHeader = h1s[i]
				sectionIndex = Array.from(docChildren).indexOf(h1s[i])
				for(let j = sectionIndex+1; j < docChildren.length; j++){
					if(docChildren[j].tagName === "H1")
						break
					else if(docChildren[j].tagName !== "INPUT")
						sectionText += docChildren[j].innerHTML
				}
				sectionNum = "Article " + sectionNum 
				break
			}
		}
	}
	//Now that we've fetched the section/article text, we should reveal any items that are hidden
	sectionText = sectionText.replace("display: none", "display: block")
	return popup(sectionNum, sectionText, mousePos, document, docNumber, sectionHeader)
}

//Helper function when finding an article by number, converts roman numerals to integers
function romanToArabic(romanNumber){
	romanNumber = romanNumber.toUpperCase();
	const romanNumList = ["CM","M","CD","D","XC","C","XL","L","IX","X","IV","V","I"];
	const corresp = [900,1000,400,500,90,100,40,50,9,10,4,5,1];
	let index =  0, num = 0;
	for(let rn in romanNumList){
		index = romanNumber.indexOf(romanNumList[rn]);
		while(index != -1){
			num += parseInt(corresp[rn]);
			romanNumber = romanNumber.replace(romanNumList[rn],"-");
			index = romanNumber.indexOf(romanNumList[rn]);
		}
	}
	return num;
}