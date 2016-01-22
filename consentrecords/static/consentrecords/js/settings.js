var Settings = (function () {
	
	function Settings(previousPanel) {
	
		var sitePanel = new SitePanel(previousPanel, null, "Settings", "edit settings-panel");

		var navContainer = sitePanel.appendNavContainer();

		navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					showClickFeedback(this);
					hidePanelRight($(this).parents(".site-panel")[0]);
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
			
		panel2Div.appendAlertContainer();
		
		var cells = [userInstance.getCell("_first name"),
					 userInstance.getCell("_last name"),
					 userInstance.getCell("_email"),
					 userInstance.getCell("Birthday"),
					 userInstance.getCell("_public access")];
					 
		panel2Div.showEditCells(cells);
			
		showPanelLeft(sitePanel.node());
	}
	
	return Settings;
})();
