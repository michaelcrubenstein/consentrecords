/* Create a panel to show the details of the session and allow the user to sign up. */
function showSessionDetails(userInstance, session, service, previousPanelNode)
{
	var organization = session.getValue("Organization");
	var offering = session.getValue("Offering");
	var site = session.getValue("Site");
	
	session.calculateDescription();
	
	var sitePanel = new SitePanel(previousPanelNode, session, offering.getDescription(), "session");
	var panel = sitePanel.node();
	
	var navContainer = sitePanel.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", handleCloseRightEvent);
	backButton.append("span").text("Done");
	
	var buttonDiv = navContainer.appendRightButton();
	
	var shareDiv = null;

	var panel2Div = sitePanel.appendScrollArea();
	panel2Div.appendHeader();
	
	if (organization)
	{
		var orgDiv = panel2Div.append("section");
		orgDiv.classed("organization", true);

		var labelDiv = orgDiv.append("label")
			.text(organization.getDescription());

		if (site.getDescription() && (site.getDescription() !== organization.getDescription()))
		{
			orgDiv.append('div')
				.classed("address-line", true)
				.text(site.getDescription());
		}
		
		crp.pushCheckCells(site, undefined, function()
		{
			var address = site.getValue("Address");
			appendAddress(address, orgDiv);
		},
		function() { }
		);
	}
	
	function appendStringDatum(cellName)
	{
		var v = session.getDatum(cellName);
		if (v)
		{
			var deadlineDiv = panel2Div.append("section");
			appendStringItem(deadlineDiv.node(), cellName, v);
			return deadlineDiv;
		}
		else
			return null;
	}
	
	var firstDiv = null;
	var nextDiv;
	firstDiv = appendStringDatum("Registration Deadline");
	
	nextDiv = appendStringDatum("Start");
	if (!firstDiv)
		firstDiv = nextDiv;
		
	nextDiv = appendStringDatum("End");
	if (!firstDiv)
		firstDiv = nextDiv;

	var cellDiv = panel2Div.append("section")
		.classed("cell", true);
	
	crp.pushCheckCells(offering, undefined, function()
		{
			var serviceCell = offering.getCell("Service");
			serviceCell.field.label = "Markers";
			if (!service && serviceCell.data.length > 0)
				service = serviceCell.data[0];
				
			if (service)
			{
				shareDiv = sitePanel.appendBottomNavContainer();

				shareDiv.div.classed("share-container border-above", true);

				appendFacebookButton(shareDiv, service, session);
			}

			if (serviceCell.data.length > 0)
			{
				serviceCell.appendLabel(cellDiv.node());
				var itemsDiv = cellDiv.append("ol").classed("items-div", true);

				var divs = appendItems(itemsDiv, serviceCell.data);
				var buttons = divs.append("div").classed("multi-line-item", true);
				appendButtonDescriptions(buttons);
				cellDiv.append("div").classed("cell-border-below", true);
			}
		},
		asyncFailFunction);
	
	var agesDiv = panel2Div.append("section");
	showAgeRange(offering, function(newText)
		{
			if (newText)
			{
				appendStringItem(agesDiv.node(), "Ages", newText);
			}
		});
	var gradesDiv = panel2Div.append("section");
	showGradeRange(offering, function(newText)
		{
			if (newText)
			{
				appendStringItem(gradesDiv.node(), "Grades", newText);
			}
		});
	
	var webSiteDiv = panel2Div.append("section");	
	showWebSite(offering, function(newText)
		{
			if (newText)
			{
				var labelDiv = webSiteDiv.append("div")
					.classed("more-info", true);
				var link = labelDiv
					.append("a")
					.classed("site-active-text", true)
					.attr("href", newText)
					.attr("target", "_blank")
					.text("More Info");
			}
		});

	var inquiryValueID = null;
	
	var checkInquiryFunction = function(newValueID)
	{
		inquiryValueID = newValueID;
		if (newValueID)
		{
			buttonDiv.text("Back Out");
			buttonDiv.on("click", deleteInquiryFunction);
		}
		else
		{
			buttonDiv.text("Sign Up");
			buttonDiv.on("click", addNameFunction);
		}
	};
	
	var addInquiry = function()
	{
		groupPath = '#'+organization.getValueID() + '>"Inquiry Access Group"';
		cr.selectAll({path: groupPath,
			done: function(groupPaths)
				{
					cr.addObjectValue('#'+session.getValueID()+">Inquiries",
									  '_user',
									  userInstance,
									  function(newInquiryID) { 
											function done()
											{
												bootstrap_alert.success("You have signed up for " + 
															  offering.getDescription() + "/" + session.getDescription() + "." +
															  " Look out for a notice when you are enrolled.",
															  ".alert-container");
												checkInquiryFunction(newInquiryID); 
											};
											if (groupPaths.length == 0)
												done();
											else {
												addMissingAccess(userInstance, "_read", groupPaths[0], "_group", done, asyncFailFunction);
											}
										},
										asyncFailFunction);
				},
			fail: asyncFailFunction 
			});
	}
	
	var tryAddInquiry = function()
	{
		if (userInstance.getValueID())
		{
			addInquiry();
			unblockClick();
		}
		else
		{
			var onSignin = function(eventObject)
			{
				var _this = this;
				
				cr.getValues({path: '#'+session.getValueID()+">Inquiries",
					field: "_user",
					value: this.getValueID(),
					done: function(valueIDs)
					{
						if (valueIDs.length > 0)
						{
							checkInquiryFunction(valueIDs[0].id);
							bootstrap_alert.success(_this.getDescription() + 
												  " already signed up for " + 
												  offering.getDescription() + "/" + session.getDescription(),
												  ".alert-container");
						}
						else
						{
							addInquiry();
						}
					},
					fail: asyncFailFunction});
			};
			var onSigninCanceled = function(eventObject)
			{
			};
			
			$(userInstance).on("signin.cr", null, panel, onSignin);
			$(userInstance).on("signinCanceled.cr", null, panel, onSigninCanceled);
			
			$(panel).on("hiding.cr", null, userInstance, function(eventObject)
			{
				$(eventObject.data).off("signin.cr", null, onSignin);
				$(eventObject.data).off("signinCanceled.cr", null, onSigninCanceled);
			});
			
			showFixedPanel(panel, "#id_sign_in_panel");
		}
	}
	
	var addNameFunction = function(e)
	{
		if (prepareClick('click', 'Sign Up'))
		{
			showClickFeedback(this);
			
			tryAddInquiry();
		}
		d3.event.preventDefault();
	};
	
	var deleteInquiryFunction = function(e)
	{
		if (prepareClick('click', 'Back Out'))
		{
			showClickFeedback(this);
			
			var successFunction = function(valueID)
			{
				bootstrap_alert.success("You have backed out of " + 
							  offering.getDescription() + "/" + session.getDescription() + ".",
							  ".alert-container");
				checkInquiryFunction(null);
			}
			
			cr.deleteValue(inquiryValueID, successFunction, asyncFailFunction);
			
			unblockClick();
		}
		d3.event.preventDefault();
	};
	
	if (userInstance.getValueID())
	{
		function done(values)
		{
			checkInquiryFunction(values.length ? values[0].id : null);
		}
		cr.getValues({path: '#'+session.getValueID()+">Inquiries",
			field: "_user",
			value: userInstance.getValueID(),
			done: done,
			fail: asyncFailFunction});
	}
	else
		checkInquiryFunction(null);
	
	return sitePanel;
}
		
var PickOfferingSearchView = (function () {
	PickOfferingSearchView.prototype = new PanelSearchView();
	
	/* Overrides SearchView.prototype.onClickButton */
	PickOfferingSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'pick ' + d.getDescription()))
		{
			this.sitePanel.updateValues(d, null);
		}
		d3.event.preventDefault();
	}
	
	/* Overrides SearchView.prototype.isButtonVisible */
	PickOfferingSearchView.prototype.isButtonVisible = function(button, d)
	{
		var val = this._constrainCompareText;
		return d.getDescription().toLocaleLowerCase().indexOf(val) >= 0 ||
			   d.getValue("Offering").getDescription().toLocaleLowerCase().indexOf(val) >= 0 ||
			   d.getValue("Site").getDescription().toLocaleLowerCase().indexOf(val) >= 0 ||
			   d.getValue("Organization").getDescription().toLocaleLowerCase().indexOf(val) >= 0;
	}
	
	/* Overrides SearchView.searchPath */
	PickOfferingSearchView.prototype.searchPath = function(val)
	{
		var currentDate = new Date();
		var todayString = currentDate.toISOString().substring(0, 10);
		var s = "#" + this.marker.instanceID + '::reference(Offering)>Sessions>Session:not(["Registration Deadline"<"' + todayString + '"])';
		if (val.length == 0)
			return s;
		else if (val.length < 3)
			return s + '[ancestor:_name^="' + val + '"]';
		else
			return s + '[ancestor:_name*="' + val + '"]';
	}
	
	PickOfferingSearchView.prototype.showObjects = function(foundObjects)
	{
		var _this = this;
		var sections = this.appendButtonContainers(foundObjects);
		var buttons = sections.append("button").classed("btn row-button", true)
			.on("click", function(session)
				{
					if (prepareClick('click', 'show details: ' + session.getDescription()))
					{
						showClickFeedback(this);

						var sitePanel = showSessionDetails(userInstance, session, _this.marker, _this.sitePanel.node());
	
						showPanelLeft(sitePanel.node());
					}
				});

		appendSessionDescriptions(buttons);
		
		this.constrainFoundObjects();
		return buttons;
	}
	
	function PickOfferingSearchView(sitePanel, marker)
	{
		this.marker = marker;
		PanelSearchView.call(this, sitePanel);
	}
	
	return PickOfferingSearchView;
})();

var PickOfferingPanel = (function() {
	PickOfferingPanel.prototype = new SitePanel();
	PickOfferingPanel.prototype.offeringID = null;
	
	function PickOfferingPanel(userInstance, marker, offeringID, previousPanel) {
		var header = "Find a New Experience";
		SitePanel.call(this, previousPanel, null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
			
		navContainer.appendTitle(header);

		this.searchView = new PickOfferingSearchView(this, marker);
		this.searchView.search("");

		showPanelLeft(this.node());
	}
	
	return PickOfferingPanel;
})();

var FindExperiencePanel = (function () {
	FindExperiencePanel.prototype = new SitePanel();
	
	function FindExperiencePanel(userInstance, serviceValueID, offeringID, previousPanel) {
		var header = "Find a New Experience";
		SitePanel.call(this, previousPanel, null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
			
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

		var _this = this;
		var successFunction = function(newInstances)
		{
			for (var i = 0; i < newInstances.length; i++)
			{
				var newI = crp.pushInstance(newInstances[i]);
				cell.pushValue(newI);
			}
			
			panel2Div.datum(cell);
			appendViewCellItems(itemsDiv, cell, 
				function(d) {
					if (prepareClick('click', 'pick ' + d.cell.field.name + ': ' + d.getDescription()))
					{
						showClickFeedback(this);
						
						var panel = new PickOfferingPanel(userInstance, d, offeringID, _this.node());
					}
				});
				
			crv.stopLoadingMessage(loadingMessage);
			loadingMessage.remove();
			for (var i = 0; i < cell.data.length; ++i)
			{
				var d = cell.data[i];
				if (d.getValueID() == serviceValueID)
				{
					var panel = new PickOfferingPanel(userInstance, d, offeringID, _this.node);
					break;
				}
			}
		}
		
		var loadingMessage = crv.appendLoadingMessage(panel2Div.node());
			
		var path = "Service";
		crp.getData({path: path, 
					 done: successFunction, 
					 fail: asyncFailFunction});

		showPanelLeft(this.node());
	}
	
	return FindExperiencePanel;
})();
