window.scrollScript ={
	//The function that actually adjusts where the doc is scrolled to
	scrollTo: function(scrollingDoc, targetP){
		if(!scrollingDoc || !targetP) return

		// Get element position relative to the scroll container (offsetTop alone
		// is relative to offsetParent, which may not be scrollingDoc)
		let elementTop = 0
		let el = targetP
		while(el && el !== scrollingDoc){
			elementTop += el.offsetTop
			el = el.offsetParent
		}

		// Get sticky header height
		let header = scrollingDoc.querySelector('.doc-version-header')
		let headerH = header ? header.offsetHeight : 0

		// Scroll so the element appears just below the header with a small buffer
		scrollingDoc.scrollTop = elementTop - headerH - 8
	},


	findSection: function(clickedSection, docSlots, docBlocks){
		//remove the section number
		let clickedTextContent = clickedSection.textContent.substring(clickedSection.textContent.indexOf(clickedSection.textContent.split(" ")[1]))
		for(let i = 0; i < docSlots.length; i++){
			h1s = docSlots[i].getElementsByTagName("H1")
			h2s = docSlots[i].getElementsByTagName("H2")
			//Iterate through all of the h1s then all of the h2s
			//to find the selected section
			//When we find it, scroll to it using scrollTo
			for(let j = 0; j < (h1s.length + h2s.length); j++){
				if(j < h1s.length){
					//If we found the header
					//Keep in mind each header will be written as 'ARTICLE 3 Section', so we wanna cut that number out
					if(h1s[j].textContent.substring(h1s[j].textContent.split(" ")[0].length + h1s[j].textContent.split(" ")[1].length + 2) === clickedTextContent){
						window.scrollScript.scrollTo(docBlocks[i], h1s[j])
						break
					}
				}
				else{
					//We actually wanna include the section number when searching for a subsection, as
					//the same section name can appear multiple times, so we need to know which one
					if(h2s[j-h1s.length].textContent === clickedSection.textContent){
						//If the selected section is hidden (the article might be collapsed), 
						//scroll to the article header
						if(h2s[j-h1s.length].style.display === "none"){
							//rip the article number from the clicked section
							let articleNumber = clickedSection.textContent.substring(0, 1)
							window.scrollScript.scrollTo(docBlocks[i], h1s[articleNumber-1])
						}
						else
							window.scrollScript.scrollTo(docBlocks[i], h2s[j-h1s.length])
						break
					}
				}
			}
		}
	},

	/*
	Upon clicking a paragraph in a doc, scroll all docs to that
	paragraph. This is done by finding the most similar paragraph
	in each doc and scrolling to it, so there may be some inaccuracy
	*/
	findMatchingParagraphs: function(clickedParagraph, docNumber, docSlots, docBlocks){
		let bestMatch
		let allParagraphs
		let allParagraphsText
		let clickedTextContent
		//If the paragraph we clicked was split into spans, then the clicked content will only be one word
		//In such a case, we wanna go up a level to grab the *whole* paragraph
		if(clickedParagraph.tagName === "SPAN")
			clickedTextContent = clickedParagraph.parentElement.textContent
		else
			clickedTextContent = clickedParagraph.textContent
		for(let i = 0; i < docSlots.length; i++){
			//First fetch all <p> tags from the doc
			allParagraphs = docSlots[i].getElementsByTagName("P")
			if(allParagraphs[0] === undefined)
				break
			//Now rip the textContent from each one so we have an array of strings
			allParagraphsText = Array.from(allParagraphs).map(x => x.textContent)
			bestMatch = stringSimilarity.findBestMatch(clickedTextContent, allParagraphsText)
			//Now scroll to the best match
			if(bestMatch.ratings[bestMatch.bestMatchIndex].rating > 0.6){
				//If it's hidden, work our way up to the nearest visible header to scroll to
				if(allParagraphs[bestMatch.bestMatchIndex].style.display === "none"){
					let allTags = docSlots[i].childNodes
					for(let j = Array.from(allTags).indexOf(allParagraphs[bestMatch.bestMatchIndex]); j >= 0; j--){
						if(allTags[j].style.display !== "none"){
							window.scrollScript.scrollTo(docBlocks[i], allTags[j])
							break
						}
					}
				}
				else
					window.scrollScript.scrollTo(docBlocks[i], allParagraphs[bestMatch.bestMatchIndex])
			}
		}
	}
}