var Settings = (function () {

	Settings.prototype.appendActionButton = function(panel2Div, text, onClick)
	{
		var itemsDiv = panel2Div.append('section')
			.classed('cell edit unique', true)
			.classed('btn row-button', true)
			.on('click', onClick)
			.append('ol').classed('items-div', true);
		
		var button = itemsDiv.append('li')
			.append('div')
			.classed('left-expanding-div', true);
		appendRightChevrons(button);
			
		button.append('div')
			.classed("description-text string-value-view", true)
			.text(text);	
			
	}
	
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
			
		doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
				})
 			.append("span").text("Done");
			
		var cells = [userInstance.getCell("_first name"),
					 userInstance.getCell("_last name"),
					 userInstance.getCell("Birthday"),
					 userInstance.getCell("_public access")];
					 
		panel2Div.showEditCells(cells);
		
		this.appendActionButton(panel2Div, 'Change Email', function() {
				if (prepareClick('click', 'Change Email'))
				{
					var panel = new UpdateUsernamePanel(userInstance, sitePanel.node());
				}
			});
		
		this.appendActionButton(panel2Div, 'Change Password', function() {
				if (prepareClick('click', 'Change Password'))
				{
					var panel = new UpdatePasswordPanel(sitePanel.node());
					showPanelLeft(panel.node());
				}
			});
		
		showPanelLeft(sitePanel.node());
	}
	
	return Settings;
})();
