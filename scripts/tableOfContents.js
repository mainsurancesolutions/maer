

module.exports = {
	renderToC: async function(field, contents){
		/*
		The contents will be of the form
		[[section, [subsections]], [section, [subsections]], ...]
		So we will iterate through the array to each [section, [subsections]]
		Then create a new listitem for each section with sub-listitems for each subsection
		*/
		Promise.resolve().then(function(){
			let newListItem
			let document = field.ownerDocument
			for(let i = 0; i < contents.length; i++){
				newListItem = document.createElement("li")
				newListItem.appendChild(contents[i][0])
				for(let j = 0; j < contents[i].length; j++){
					newListItem.appendChild(document.createElement("li").appendChild(contents[i][j]))
				}
				console.log(field)
				console.log(newListItem)
				field.appendChild(newListItem)
			}
		})		
	}
}