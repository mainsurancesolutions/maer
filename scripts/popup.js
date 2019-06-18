let popupHTML = fs.readFileSync('definitionPopup.html')
//Each pop-up will have a z index ensuring they appear above everything else
//we increment that counter with each new popup so that if you have multiple popups,
//the most recent will show up in front of all others
let zCounter = 2

module.exports ={
	/*
	Triggered upon hovering over a term.
	If you hover over long enough, the definition of that term will appear
	along with buttons to scroll to it
	allDefinitions: detailed by the getDefs function, where it is created
	We want to give the user the definition as it is defined in the current document
	If the definition is not present in the given document, see if it's in the others, starting with the most recent doc
	*/
	hover: function(allDefinitions, hoveredWord, mousePos, docSlots, docNumber){
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
		if(hoveredWord.substring(hoveredWord.length-1) === "," || hoveredWord.substring(hoveredWord.length-1) === "." || hoveredWord.substring(hoveredWord.length-1) === "\"" || hoveredWord.substring(hoveredWord.length-1) === ":")
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
			console.log("not found")
			return
		}
		//If there's only 1 match, we can use that
		if(docTerms.length === 1 && lastDocTerms.length === 0)
			return popup(hoveredWord, allDefinitions[docNumber][docTerms[0][1]][1], mousePos, docSlots[0].ownerDocument)
		else if(docTerms.length === 0 && lastDocTerms === 1)
			return popup(hoveredWord, allDefinitions[docSlots.length-2][lastDocTerms[0][1]][1], mousePos, docSlots[0].ownerDocument)		//If we reach here, both docs contain multiple matches for the definition
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
		popup(definition[0], definition[1], mousePos, docSlots[0].ownerDocument)
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
				if(headers[j].textContent === "Definitions")
					definitionsHeader = headers[j]
			}
			//Now we find the header index in the nodes of the doc, and start gather definitions
			//in that section
			let textNodes = Array.from(docSlots[i].childNodes)
			//To be populated as [term, definition]
			for(let j = textNodes.indexOf(definitionsHeader)+2; j < textNodes.length; j++){
				let termAndDef = [null, null]
				if(textNodes[j].tagName !== "P")
					break
				termAndDef[0] = textNodes[j].textContent.split("\"")[1]
				termAndDef[1] = textNodes[j].textContent.substring(termAndDef[0].length+3)
				docTermsAndDefs.push(termAndDef)
			}
			allDefinitions.push(docTermsAndDefs)
		}
		return allDefinitions
	}
}

function popup(term, definition, mousePos, document){
	let popupElement = document.createElement('div')
	popupElement.innerHTML = popupHTML
	console.log(document.getElementById('docs-and-console'))
	document.getElementById('docs-and-console').appendChild(popupElement)
	//Position the element where you hovered
	popupElement.style.left = mousePos[0] + "px"
	popupElement.style.bottom = "0px"

	popupElement.classList.add("popup")
	//The 1st element is the button to close the window
	popupElement.childNodes[0].addEventListener('click', ()=>{
		popupElement.parentElement.removeChild(popupElement)
	})
	popupElement.childNodes[1].textContent = term
	popupElement.childNodes[2].textContent = definition
	popupElement.style.zIndex = zCounter
	zCounter++
}