var FindExperiencePanel = (function () {
	FindExperiencePanel.prototype = new SitePanel();
	
	function FindExperiencePanel(userInstance, serviceValueID, offeringString, previousPanel) {
		var header = "Find a New Experience";
		SitePanel.call(this, previousPanel, null, header, "lise");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
			
		navContainer.appendRightButton()
			.classed('add-button', true)
			.on("click", function()
			{
				if (prepareClick())
				{
					hidePanelRight(sitePanel.node());
				}
				d3.event.preventDefault();
			})
			.append("span").text("+");
		
		navContainer.appendTitle(header);
		
		textChanged = function()
		{
			var val = this.value.toLocaleLowerCase();
			if (val.length == 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", null);
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return "none";
						});
			}
		}

		this.appendSearchBar(textChanged);
		
		var panel2Div = this.appendScrollArea();
		panel2Div.appendAlertContainer();

		var field = {
					  dataType: "_object",
					  name: "Service",
					  capacity: "_multiple values",
					  };
		var cell = cr.createCell(field);
		cell.setup(null);

		var itemsDiv = panel2Div.append("section")
			.classed("multiple", true)
			.append("ol")
			.classed("items-div border-above", true)
			.datum(cell);

		var successFunction = function(newInstances)
		{
			newInstances.sort(function(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				});
				
			for (var i = 0; i < newInstances.length; i++)
			{
				var newI = crp.pushInstance(newInstances[i]);
				cell.pushValue(newI);
			}
			
			panel2Div.datum(cell);
			appendViewCellItems(itemsDiv, cell, 
				function(d) {
					if (prepareClick())
					{
						var panelDiv = d3.select("#id_find_offering_panel");
						panelDiv.datum(d);
						showClickFeedback(this);
			
						showPanelLeft(panelDiv.node());
					}
				});
				
			panel2Div.selectAll('p').remove();
			for (var i = 0; i < cell.data.length; ++i)
			{
				var d = cell.data[i];
				if (d.getValueID() == serviceValueID)
				{
					d3.select("#id_find_offering_panel").datum(d);
					showPanelNow("#id_find_offering_panel");
					break;
				}
			}
		}
		
		panel2Div.appendLoadingMessage();
			
		var path = "Service";
		crp.getData({path: path, 
					 done: successFunction, 
					 fail: asyncFailFunction});

		showPanelLeft(this.node());
	}
	
	return FindExperiencePanel;
})();