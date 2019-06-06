module.exports ={
	findSection: function(clickedSection, docSlots, docBlocks){
		let clickedTextContent = clickedSection.textContent
		for(let i = 0; i < docSlots.length; i++){
			headers = docSlots[i].getElementsByTagName("H2") + docSlots[i].getElementsByTagName("H3")
			for(let j = 0; j < headers.length; j++)
				if(headers[j].textContent === clickedTextContent)
					scrollToSection(docSlots[i], headers[j])
		}
		console.log(clickedTextContent)
	}
}


function scrollTo(scrollingDoc, targetP){
	scrollingDoc.scrollTop = targetP.offsetTop
}