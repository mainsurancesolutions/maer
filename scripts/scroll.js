let stringSimilarity = require('string-similarity')

module.exports ={
	findSection: function(clickedSection, docSlots, docBlocks){
		let clickedTextContent = clickedSection.textContent
		for(let i = 0; i < docSlots.length; i++){
			h2s = docSlots[i].getElementsByTagName("H2")
			h3s = docSlots[i].getElementsByTagName("H3")
			//Iterate through all of the h2s then all of the h3s
			//to find the selected section
			//When we find it, scroll to it using scrollTo
			for(let j = 0; j < (h2s.length + h3s.length); j++){
				if(j < h2s.length){
					if(h2s[j].textContent === clickedTextContent && h2s[j].style.display !== "none"){
						scrollTo(docBlocks[i], h2s[j])
						break
					}
				}
				else
					if(h3s[j-h2s.length].textContent === clickedTextContent && h3s[j-h2s.length].style.display !== "none"){
						scrollTo(docBlocks[i], h3s[j-h2s.length])
						break
					}
			}
		}
	},

	/*
	Upon clicking a paragraph in a doc, scroll all docs to that
	paragraph. This is done by finding the most similar paragraph
	in each doc and scrolling to it, so there may be some inaccuracy
	*/
	findMatchingParagraphs: function(clickedTextContent, docNumber, docSlots, docBlocks){
		let bestMatch
		let allParagraphs
		let allParagraphsText
		for(let i = 0; i < docSlots.length; i++)
			if(i !== docNumber){
				//First fetch all <p> tags from the doc
				allParagraphs = docSlots[i].getElementsByTagName("P")
				if(allParagraphs[0] === undefined)
					break
				//Now rip the textContent from each one so we have an array of strings
				allParagraphsText = Array.from(allParagraphs).map(x => x.textContent)
				bestMatch = stringSimilarity.findBestMatch(clickedTextContent, allParagraphsText)
				//Since each doc only shows paragraphs with differences, scrolling to a paragraph that's an
				//exact match causes issues
				if(bestMatch.ratings[bestMatch.bestMatchIndex].rating !== 1)
					scrollTo(docBlocks[i], allParagraphs[bestMatch.bestMatchIndex])
			}
	}
}


function scrollTo(scrollingDoc, targetP){
	scrollTarget = targetP.offsetTop - (scrollingDoc.offsetHeight/2)
	scrollingDoc.scrollTop = scrollTarget
}