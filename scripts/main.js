const electron = require('electron')
const {app, BrowserWindow, BrowserView, dialog, shell} = electron
const fs = require('fs')
const path = require('path')
const ipc = require('electron').ipcMain
let mainWindow
let defPage
let loadedName = ""

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
	if(process.platform !== 'darwin'){
		app.quit()
	}
});

function createMainWindow(){
	mainWindow = new BrowserWindow({
		icon: 'C:/MA/ElectronTest/images/icon.ico',
		frame: false,
		webPreferences: {
        	nodeIntegration: true
        },
        'minHeight': 480,
        'minWidth': 640
	});
	mainWindow.loadFile('index.html')
	//mainWindow.openDevTools()
	//Account for any case which could change the position
	mainWindow.on('maximize', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})
	mainWindow.on('unmaximize', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})
	mainWindow.on('resize', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})
	mainWindow.maximize()
	//When the main window is moved, send a signal to let it know its position changed
	mainWindow.on('move', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})	
}

//####################THIS CODE MAKES THE PROGRAM EXPIRE AFTER 6 MONTHS############
/*
In order to remove the 'demo version' limitation, simply remove this function, the corresponding ipc
function in mainWindow.js, as well as the check for it in the 'compare-button' event in mainWindow.js.
This function operates by placing a 'date' file in the users appdata folder the first time they click compare
The 'date' file contains a 'date' object for 6 months in the future. If this file does not exist, this will
create it. Then, whenever the compare button is clicked, it will make a new date object. If the new date
is later than the stored one, it will say the demo has expired. Effectively creating a 6 month
trial edition.
*/
ipc.on('getDemoDate', (event, arg) =>{
	let appDataPath = (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : process.env.HOME + "/.local/share"))
	console.log(appDataPath)
	if(fs.existsSync(appDataPath + '/MA-Easy-Reader/maerdata')){
		let jsonDate = fs.readFileSync(appDataPath + '/maerdata', 'utf8')
		let endDate = new Date(JSON.parse(jsonDate))
		mainWindow.webContents.send('demoEndDate', endDate)
	}
	//If the file doesn't exist, create and populate it with a date
	else{
		let endDate = new Date()
		//Add 6 months to the date
		endDate = new Date(endDate.getTime() + 15770000000)
		let jsonDate = JSON.stringify(endDate)
		fs.writeFileSync(appDataPath + '/MA-Easy-Reader/maerdata', jsonDate, function(err){
			if(err){
				console.log(err)
				throw err
			}
		})
		mainWindow.webContents.send('demoEndDate', endDate)
	}
})
//#############################TRIAL VERSION CODE END###########################

ipc.on('getPos', (event, arg) =>{
	mainWindow.webContents.send('position', mainWindow.getPosition())
})

ipc.on('close', (event, arg) =>{
	if(process.platform !== 'darwin'){
		app.quit()
	}
	else{
		win.hide()
	}
})

ipc.on('maximize', (event, arg) =>{
	if(mainWindow.isMaximized()){
		mainWindow.unmaximize()
	} else{
		mainWindow.maximize()
	}
})

ipc.on('minimize', (event, arg) =>{
	mainWindow.minimize()
})

ipc.on('restart', (event, arg) =>{
	mainWindow.reload()
})

ipc.on('save', (event, arg) =>{
	dialog.showSaveDialog(mainWindow, {
		defaultPath: loadedName,
		filters:{extensions: 'maer'}
	}, (path) =>{
		if(path !== undefined){
			//No need to add the .maer extension if it already has it
			if(path.substring(path.lastIndexOf(".")) !== ".maer")
				path += ".maer"
			mainWindow.webContents.send('savePath', path)
		}
	})
})

ipc.on('load', (event, arg) =>{
	dialog.showOpenDialog(mainWindow, {
		filters:{extension: 'maer'},
		properties: ['openfile']
	}, (file) =>{
		if(file !== undefined){
			if(file[0].slice(-5) !== '.maer')
				mainWindow.webContents.send('wrongType')
			else{
				mainWindow.webContents.send('loadFile', file[0])
				//Store the filename of the loaded file
				loadedName = file[0]
			}
		}
	})
})

ipc.on('edit', (event, arg) =>{
	shell.openItem(arg)
})

//Open definitions window
//arg is the allDefinitions array from mainWindow.js
ipc.on('definitions', (event, arg) =>{
	defPage = new BrowserWindow({
		parent: mainWindow,
		webPreferences: {
        	nodeIntegration: true
        },
        show: false,
        frame: false
	})
	defPage.webContents.send('position', defPage.getPosition())
	defPage.on('move', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.on('maximize', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.on('unmaximize', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.on('resize', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.loadFile('definitions.html')
	defPage.removeMenu()
	//defPage.openDevTools()
	defPage.once('ready-to-show', () =>{
		defPage.send('loadDefinitions', arg)
		defPage.show()
	})
})

ipc.on('closeDef', (event, arg) =>{
	defPage.close()
})

ipc.on('maximizeDef', (event, arg) =>{
	if(defPage.isMaximized()){
		defPage.unmaximize()
	} else{
		defPage.maximize()
	}
})

ipc.on('minimizeDef', (event, arg) =>{
	defPage.minimize()
})

//When a section number is hovered in the definitions doc, send that to the main page
//to get the text in the section, then send that text back to the definitions page to render
ipc.on('getSection', (event, arg) =>{
	mainWindow.send('getSection', arg)
})
ipc.on('sendSection', (event, arg) =>{
	defPage.webContents.send('sendSection', arg)
})
ipc.on('re-hover', (event, arg) =>{
	defPage.webContents.send('re-hover', arg)
})