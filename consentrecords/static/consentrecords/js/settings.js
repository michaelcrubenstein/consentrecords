var Settings = (function () {
	
	function Settings(previousPanel) {
	
		var sitePanel = new SitePanel(previousPanel, null, "Settings", "edit settings-panel");

		var navContainer = sitePanel.appendNavContainer();

		navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					showClickFeedback(this);
					hidePanelRight(sitePanel.node());
				}
				d3.event.preventDefault();
			})
			.append("span").text("Cancel");

		var doneButton = navContainer.appendRightButton();
			
		navContainer.appendTitle('Settings');
		
		var panel2Div = sitePanel.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
			
		doneButton.on("click", panel2Div.handleDoneEditingButton)
 			.append("span").text("Done");
			
		var cells = [userInstance.getCell("_first name"),
					 userInstance.getCell("_last name"),
					 userInstance.getCell("_email"),
					 userInstance.getCell("Birthday"),
					 userInstance.getCell("_public access")];
					 
		panel2Div.showEditCells(cells);
		
		var itemsDiv = panel2Div.append('section')
			.classed('cell edit unique', true)
			.classed('btn row-button', true)
			.on('click', function() {
				if (prepareClick('click', 'Change Password'))
				{
					var panel = new UpdatePasswordPanel(sitePanel.node());
					showPanelLeft(panel.node());
				}
			})
			.append('ol').classed('items-div', true);
		
		var button = itemsDiv.append('li')
			.append('div')
			.classed('left-expanding-div', true);
		appendRightChevrons(button);
			
		button.append('div')
			.classed("description-text string-value-view", true)
			.text("Change Password");	
			
		showPanelLeft(sitePanel.node());
	}
	
	return Settings;
})();
