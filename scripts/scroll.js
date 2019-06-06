module.exports ={
	findSection: function(clickedSection, docSlots, docBlocks){
		let clickedTextContent = clickedSection.textContent
		for(let i = 0; i < docSlots.length; i++){
			h2s = docSlots[i].getElementsByTagName("H2")
			h3s = docSlots[i].getElementsByTagName("H3")
			//Iterate through all of the h2s then all of the h3s
			//to find the selected section
			//When we find it, scroll to it using scrollToSection
			for(let j = 0; j < (h2s.length + h3s.length); j++){
				if(j < h2s.length){
					if(h2s[j].textContent === clickedTextContent){
						scrollToSection(docBlocks[i], h2s[j])
						break
					}
				}
				else
					if(h3s[j-h2s.length].textContent === clickedTextContent){
						scrollToSection(docBlocks[i], h3s[j-h2s.length])
						break
					}
			}
		}
	}
}


function scrollToSection(scrollingDoc, targetP){
	scrollTarget = targetP.offsetTop - (scrollingDoc.offsetHeight/2)
	scrollingDoc.scrollTop = scrollTarget
}