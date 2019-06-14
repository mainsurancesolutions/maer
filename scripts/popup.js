module.exports ={
	/*
	Triggered upon hovering over a term.
	If you hover over long enough, the definition of that term will appear
	along with buttons to scroll to it
	allDefinitions: detailed by the getDefs function, where it is created
	We want to give the user the definition as it is defined in the current document
	If the definition is not present in the given document, see if it's in the others, starting with the most recent doc
	*/
	/*
	hover: function(allDefinitions, hoveredWord, docSlots, docNumber){
		//Remember that allDefinitions[docNumber] is the array of [term, definition] for the given doc
		//We'll populate this with all of the terms from the current doc, then compare the hovered word to them
		//to find the closest match
		let docTerms = []
		for(let i = ; i < allDefinitions[docNumber].length; i++){
			docTerms.push(allDefinitions[docNumber][i])
		}
		bestMatch = stringSimilarity.findBestMatch(hoveredWord, docTerms)

	},*/

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
		console.log(allDefinitions)
		return allDefinitions
	}
}