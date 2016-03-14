var UserPanel = (function() {
	UserPanel.prototype = new SitePanel();
	
	function UserPanel(user, previousPanelNode)
	{
		SitePanel.call(this, previousPanelNode, user, user.getDescription(), "view", revealPanelLeft);
		this.user = user;

		var _this = this;
		
		try
		{
			var navContainer = this.appendNavContainer();

			var backButton = navContainer.appendLeftButton()
				.on("click", handleCloseRightEvent);
			appendLeftChevrons(backButton).classed("site-active-text", true);
			backButton.append("div").text(" " + previousPanelNode.getAttribute("headerText"));
	
			var panel2Div = this.appendScrollArea();

			var headerDiv = panel2Div.appendHeader();

			panel2Div.append("div").classed("cell-border-below", true);
			user.checkCells([], function()
				{
					var cells = [];
					var cell = user.getCell("_email");
					if (cell) cells.push(cell);
					var cell = user.getCell("_first name");
					if (cell) cells.push(cell);
					var cell = user.getCell("_last name");
					if (cell) cells.push(cell);
					cell = user.getCell("Birthday");
					if (cell) cells.push(cell);
					_this.showViewCells(cells);

					_this.appendActionButton('Pathway', function() {
							if (prepareClick('click', 'Pathway'))
							{
								var panel = new PathwayPanel(user, _this.node());
								panel.pathway.setUser(user, true);
								showPanelLeft(panel.node());
							}
						});		
				},
				asyncFailFunction);
		}
		catch(err)
		{
			this.panelDiv.remove();
			throw err;
		}
	}
	
	return UserPanel;
})();
