

module.exports ={
	/*
	Triggered upon hovering over a term.
	If you hover over long enough, the definition of that term will appear
	along with buttons to scroll to it
	*/
	//hover: function(allDefinitions, clickedWord, docSlots, docNumber){

	//},

	//Populate the allDefinitions array with tuples of terms and their definitions
	getDefs: function(docSlots){
		let allDefinitions = []
		/*
		Create an array of arrays of [term, definition] for each doc
		so [ [ [term, definition], [term, definition], [term, definition] ] , [ [term, definition], [term, definition], [term, definition] ], ...]
		*/
		for(let i = 0; i < docSlots.length; i++){
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
			let textNodes = docSlots[i].childNodes
			//To be populated as [term, definition]
			let termAndDef = [null, null]
			for(let j = textNodes.indexOf(definitionsHeader); j < textNodes.length; j++){
				if(textNodes[j].tagName !== "P")
					break
				termAndDef[0] = textNodes[j].split(" ")[0]
				termAndDef[1] = textNodes[j].substring(termAndDef[0].length+1)
				docTermsAndDefs.push(termAndDef)
			}
		}
		return allDefinitions
	},

	//Sets up for the hover function by wrapping each word in a <span class='word'></span>
	wrapWords: function(docSlots){
		for(let i = 0; i < docSlots.length; i++){
			let textNodes = docSlots[i].childNodes
			for(let j = 0; j < textNodes.length; j++){
				console.log(j)
				textNodes[j].insertAdjacentHTML('beforebegin', '<span class=\'word\'>')
				textNodes[j].insertAdjacentHTML('afterend', '</span>')
			}
		}
	}
}