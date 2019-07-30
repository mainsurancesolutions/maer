const popupHTML = fs.readFileSync('definitionPopup.html')
const scrollScript = require('..\\scripts\\scroll.js')
//Each pop-up will have a z index ensuring they appear above everything else
//we increment that counter with each new popup so that if you have multiple popups,
//the most recent will show up in front of all others
let zCounter = 2
let position = [0, 0]

/*
This file controls what happens when you hover your mouse over a word,
creating a pop-up containing the definition if it has one, or the section text
if it's a section number
*/

module.exports ={

	setPosition: function(pos){
		position = pos
	},

	//Populate the allDefinitions array with tuples of terms and their definitions
	getDefs: function(){
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
	defPage is a boolean value. If true, it means we're hovering something in the definitions window
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
					console.log(hoveredElement)
					if(hoveredElement.innerText.trim().split(' ')[0] !== "Section" && hoveredElement.innerText.trim().split(' ')[0] !== "Article"){
						hoveredElement.innerText += "(hov)"
						return hoverDef(allDefinitions, hoveredElement, mousePos, docNumber, hoveredElement.parentElement, false)
					}
					//Hovered an article or section
					else
						return hoverSection(hoveredElement.innerText.trim(), mousePos, docNumber, false)
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
				/*If the word is "Section", we wanna wrap it with the section number
				BUT make sure the word directly after the section isnt a tag
				ie watch out for cases like "Section <a id="DocXTextRef67"></a> 210"
				We also want to make sure it's actually 'Section sectionNumber', and not something like
				'Section 409A', which is a definition, not a section in the document
				We do this by checking for a period in the following word, as a section will always have that that period
				*/
				else if(splitParagraph[i].trim() === "Section" || splitParagraph[i].trim() === "Article"){
					if(!splitParagraph[i+1].includes('<')){
						if(splitParagraph[i].trim() === "Section"){
							//If it's a section number, it will always have a period, and the first instance of a period won't be at the end
							if(splitParagraph[i+1].indexOf('.') !== -1 && splitParagraph[i+1].indexOf('.') !== splitParagraph[i+1].length-1){
								reconstructed += '<span>' + splitParagraph[i] + " " + splitParagraph[i+1] + '</span> '
								i++
							}
							else
								reconstructed += '<span>' + splitParagraph[i] + '</span> '
						}
						else{
							reconstructed += '<span>' + splitParagraph[i] + " " + splitParagraph[i+1] + '</span> '
							i++
						}
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
		let hoveredNode = document.elementFromPoint(mousePos[0], mousePos[1])
		
		let hoveredWord = hoveredNode.innerText
		console.log(splitParagraph)
		//Make sure we're not grabbing the entire paragraph
		if(hoveredWord.length < 30){
			//Hovered a definition
			if(hoveredWord.trim().split(' ')[0] !== "Section" && hoveredWord.trim().split(' ')[0] !== "Article"){
				hoveredNode.innerText += "(hov)"
				hoverDef(allDefinitions, hoveredNode, mousePos, docNumber, paragraph, false)
			}
			//Hovered an article or section
			else
				hoverSection(hoveredWord.trim(), mousePos, docNumber, false)
		}
	},

	//Altered version of the above function for hovering text in the definitions page
	wrapWordsDef: function(hoveredElement, mousePos, docNumber, document, tag){
		let paragraph
		switch(tag){
			case 'P':
				paragraph = hoveredElement
				break
			case 'SPAN':
				//This will happen if the paragraph has been hovered once before
				//in which case it's already prepared to be sent off
				if(hoveredElement.length < 30){
					//Hovered a definition
					if(hoveredElement.trim().split(' ')[0] !== "Section" && hoveredElement.trim().split(' ')[0] !== "Article"){
						hoveredElement.innerText += "(hov)"
						return hoverDef(allDefinitions, hoveredElement, mousePos, docNumber, hoveredElement.parentElement, true)
					}
					//Hovered an article or section
					else
						return hoverSection(hoveredElement.trim(), mousePos, docNumber, true)
				}
				else
					return
			default:
				return
		}
		//Split the paragraph into words and wrap them in spans
		console.log(paragraph.innerHTML)
		let splitParagraph = paragraph.innerHTML.split(" ")
		let reconstructed = ""
		//When in the definitions window, there's no risk of the text being in a tag,
		//so we can skip the process of checking for it
		for(let i = 0; i < splitParagraph.length; i++){
			//If the word is "Section", we wanna wrap it with the section number
			if(splitParagraph[i].trim() === "Section" || splitParagraph[i].trim() === "Article"){
				reconstructed += '<span>' + splitParagraph[i] + " " + splitParagraph[i+1] + '</span> '
				i++
			}
			else
				reconstructed += '<span>' + splitParagraph[i] + '</span> '
		}
		//Now that we've split the paragraph, check the hover'd element once again
		return ['re-hover', reconstructed]
	}
}

//Creates the popup after hovering a term/section name
//section is the header of the found section, for use when scrolling to it
function popup(term, definition, mousePos, document, docNumber, section, defPage){
	if(defPage)
		return [term, definition, zCounter++]
	let popupElement = document.createElement('div')
	popupElement.innerHTML = popupHTML
	document.getElementById('docs-and-console').appendChild(popupElement)

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
			popupScript.wrapWords(hoveredElement, mousePosNew, docNumber, document, false)
		}, 1100)
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
hoveredElement: The span element containing the hovered word
paragraph: the <p> element containing the hovered element
We want to give the user the definition as it is defined in the current document
If the definition is not present in the given document, see if it's in the most recent document
*/
function hoverDef(allDefinitions, hoveredElement, mousePos, docNumber, paragraph, defPage){
	//Remember that allDefinitions[docNumber] is the array of [term, definition] for the given doc
	//We'll populate this with all of the terms from the current doc, then compare the hovered word to them
	//to find the closest match
	let definition
	let splitParagraph = paragraph.innerText.split(" ")
	console.log(splitParagraph)
	//We find the hovered word by locating the word that ends with '(hov)'
	//hoveredWord will be a string containing the text contents of hoveredElement
	let hoveredWord
	let wordIndex
	for(let i = 0; i < splitParagraph.length; i++){
		if(splitParagraph[i].includes('(hov)')){
			wordIndex = i
			//Now remove the '(hov)' from the end of the word
			splitParagraph[i] = splitParagraph[i].substring(0, splitParagraph[i].length-5)
			hoveredElement.innerText = splitParagraph[i]
			hoveredWord = hoveredElement.innerText
			break
		}
	}
	console.log(hoveredWord)
	/*
	We will extract from the definitions array the following:
	[any term that has the hovered word as a substring, the index of said term]
	We will then take the longest substring, and get the definition from that
	*/
	//First trim the end of the term if it's punctuation
	while(hoveredWord.substring(hoveredWord.length-1) === "," || hoveredWord.substring(hoveredWord.length-1) === "." || hoveredWord.substring(hoveredWord.length-1) === "\"" || hoveredWord.substring(hoveredWord.length-1) === ":" || hoveredWord.substring(hoveredWord.length-1) === ";")
		hoveredWord = hoveredWord.trim().substring(0, hoveredWord.length-1)
	while(hoveredWord[0] === "\"")
		hoveredWord = hoveredWord.substring(1)
	splitParagraph = paragraph.innerText.split(" ")
	let term = matchDefinition(splitParagraph, allDefinitions[docNumber], wordIndex)[0]
	console.log(term)

	//If nothing was found, don't show a pop-up
	if(term === null)
		return false
	//If we have a match, display it
	
	//Send the term and matched definition to the popup method to be rendered
	for(let i = 0; i < allDefinitions[docNumber].length; i++){
		if(allDefinitions[docNumber][i][0] === term){
			return popup(term, "As defined in document " + (docNumber + 1) + ": " + allDefinitions[docNumber][i][1], mousePos, docSlots[0].ownerDocument, docNumber, undefined, defPage)
		}
	}

	//If somehow we made it through, this is just a failsafe case that should never be reached
	return false
}

//When you hover a word, check the other words near it to find the exact definition you're hovering
//ie, when hovering the word 'Tax' in 'Tax Returns', check the nearby words to find out that
//it should be giving the definition for 'Tax Returns'
//splitParagraph is an array of the innerText of the paragraph, split into words (by spaces)
//Returns the largest term that the hovered word is a part of
function matchDefinition(splitParagraph, definitions, startIndex, endIndex = startIndex){
	console.log([splitParagraph, definitions, startIndex, endIndex])
	if(startIndex < 0 || endIndex > splitParagraph.length-1)
		return [null, 0]
	//First check if the hovered word is a part of any defined term
	let currentTerm = ""
	for(let i = startIndex; i <= endIndex; i++){
		console.log(splitParagraph[i][splitParagraph[i].length-1])
		//remove punctuation at the end of the term
		while(splitParagraph[i][splitParagraph[i].length-1] === "." || splitParagraph[i][splitParagraph[i].length-1] === "," || splitParagraph[i][splitParagraph[i].length-1] === "\"" || splitParagraph[i][splitParagraph[i].length-1] === ")")
			splitParagraph[i] = splitParagraph[i].substring(0, splitParagraph[i].length-1)
		while(splitParagraph[i][0] === "\"" || splitParagraph[i][0] === "(")
			splitParagraph[i] = splitParagraph[i].substring(1)
		currentTerm += splitParagraph[i] + " "
	}
	currentTerm = currentTerm.trim()
	console.log(currentTerm)
	
	//Keep track of all the terms that 'could' match up to what we have hovered
	let possibleTerms = []
	for(let i = 0; i < definitions.length; i++){
		if(definitions[i][0].includes(currentTerm))
			possibleTerms.push(definitions[i])
	}
	//Keep expanding the search until there is only 1 term remaining
	if(possibleTerms.length === 0)
		return [null, 0]
	if(possibleTerms.length === 1){
		if(possibleTerms[0][0] === currentTerm)
			return [possibleTerms[0][0], possibleTerms.length]
	}
	//These will each return [full term, length of full term]
	let leftSide = matchDefinition(splitParagraph, possibleTerms, startIndex - 1, endIndex)
	let rightSide = matchDefinition(splitParagraph, possibleTerms, startIndex, endIndex + 1)
	//If no matches are found by expanding to either side, we've found the longest possible string
	//In that case, check our possible matches to see if we have an exact match
	if(leftSide[1] === 0 && rightSide[1] === 0){
		for(let i = 0; i < possibleTerms.length; i++){
			if(possibleTerms[i][0] === currentTerm)
				return [currentTerm, endIndex-startIndex+1]
		}
		return [null, 0]
	}
	if(leftSide[1] >= rightSide[1])
		return leftSide
	return rightSide
}

//Checks if the given word + the word to its left is part of a defined term
function matchLeft(splitParagraph, definitions, index){
	//Operates similarly to 
	for(let i = 0; i < definitions.length; i++){
		if(definitions[i][0] === splitParagraph[index])
			break
		if(i === definitions.length-1)
			return false
	}
}

function matchRight(splitParagraph, definitions, index){

}

/*
When you hover text like "Section 2.01" long enough, have a popup appear with the text from it
For the purposes of this function, I define the terms 'section', 'subsection', and 'sub-subsection' as follows:
Section: The level just below article. For example, 2.01, 2.02, 2.03, ... are sections
Subsection: 2.01(a), 2.01(b), 2.01(c), ...
Sub-subsection: 2.01(a)(i), 2.01(a)(ii), 2.01(a)(iii), ...
*/
function hoverSection(section, mousePos, docNumber, defPage){
	let document = docSlots[0].ownerDocument
	let docChildren = docSlots[docNumber].childNodes
	let sectionText = ""
	let sectionNum
	let fullSectionNum
	let sectionIndex
	let sectionHeader
	//If we hovered a section
	if(section.split(' ')[0] === "Section"){
		//Some section links will be written like "Section 2.02(a)(ii)"
		//sectionNum will be just the '2.02'
		//fullSectionNum will be '2.02(a)(ii)'
		fullSectionNum = section.split(' ')[1]
		sectionNum = fullSectionNum.substring(0, 4)

		//We can determine if the section link goes to subsection or sub-subsection by seeing how many '(' it contains
		let depth = fullSectionNum.split('(').length
		//Now search each section to find the number
		h2s = docSlots[docNumber].getElementsByTagName('H2')
		for(let i = 0; i < h2s.length; i++){
			if(h2s[i].textContent.includes(sectionNum)){
				//We've found the section
				sectionHeader = h2s[i]
				sectionIndex = Array.from(docChildren).indexOf(h2s[i])
				/*
				If it did specify a subsection, we must search for only that subsection and take all paragraphs from it
				If it specified a sub-subsection, we must search for the heading subsection, then the sub-subsection within it
				*/
				//If the section we hovered specified a subsection and/or a sub-subsection
				if(depth > 1){
					//First find the subsection specified. We do this by finding what comes after the first (, then the
					//index of the first ), and taking what's between them
					let subsectionLetter = fullSectionNum.split('(')[1].substring(0, fullSectionNum.split('(')[1].indexOf(')'))
					for(let j = sectionIndex+1; j < docChildren.length; j++){
						if(docChildren[j].tagName === "H1" || docChildren[j].tagName === "H2")
							break
						//Found the subsection
						if(docChildren[j].textContent.startsWith("(" + subsectionLetter + ")")){
							//Collect the first paragraph no matter what
							sectionText += docChildren[j].innerHTML
							fullSectionNum = "Section " + fullSectionNum
							//Collect the rest of the subsection if we want the whole thing
							if(depth === 2){
								for(let k = j+1; k < docChildren.length; k++){
									if(docChildren[k].classList.contains('subsection-bullet') || docChildren[k].tagName === "H1" || docChildren[k].tagName === "H2")
										break
									sectionText += "<br>" + docChildren[k].innerHTML
								}
								break
							}
							//Collect just sub-subsection text if that's all that was asked for
							//in most cases this will just be the one paragraph, but sometimes not
							else{
								//First find the sub-subsection
								let subsubsectionNum = fullSectionNum.split('(')[2].substring(0, fullSectionNum.split('(')[2].indexOf(')'))
								for(let k = j+1; k < docChildren.length; k++){
									if(docChildren[k].textContent.startsWith("(" + subsubsectionNum + ")")){
										sectionText += "<br>" + docChildren[k].innerHTML
										for(let x = k+1; x < docChildren.length; x++){
											if(docChildren[x].classList.contains('subsection-bullet') || docChildren[x].classList.contains('subsection-sub-bullet') || docChildren[x].tagName === "H1" || docChildren[x].tagName === "H2")
												break
											sectionText += "<br>" + docChildren[k].innerHTML
										}
										break
									}
								}
								break
							}
						}
					}
				}
				//If the section we hovered didn't specify a subsection, we want all paragraphs in that section
				else{
					//Take all paragraphs until we reach the next H1 or H2 tag, which would be a new article or section
					for(let j = sectionIndex+1; j < docChildren.length; j++){
						if(docChildren[j].tagName === "H1" || docChildren[j].tagName === "H2")
							break
						else
							sectionText += "<br>" + docChildren[j].innerHTML
					}
					fullSectionNum = "Section " + sectionNum
					break
				}
			}
		}
	}
	//Works pretty much the same as when fetching a section
	else if(section.split(' ')[0] === "Article"){
		//Convert the article number to an integer
		fullSectionNum = romanToArabic(section.split(' ')[1])
		h1s = docSlots[docNumber].getElementsByTagName('H1')
		for(let i = 0; i < h1s.length; i++){
			if(h1s[i].textContent.includes(" " + fullSectionNum + " ")){
				sectionHeader = h1s[i]
				sectionIndex = Array.from(docChildren).indexOf(h1s[i])
				for(let j = sectionIndex+1; j < docChildren.length; j++){
					if(docChildren[j].tagName === "H1")
						break
					else if(docChildren[j].tagName !== "INPUT")
						sectionText += "<br>" + docChildren[j].innerHTML
				}
				fullSectionNum = "Article " + fullSectionNum 
				break
			}
		}
	}
	//Now that we've fetched the section/article text, we should reveal any items that are hidden
	sectionText = sectionText.replace("display: none", "display: block")
	return popup(fullSectionNum, sectionText, mousePos, document, docNumber, sectionHeader, defPage)
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