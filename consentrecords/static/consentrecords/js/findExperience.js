/* Create a panel to show the details of the session and allow the user to sign up. */
function showSessionDetails(session, service, previousPanelNode)
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
			appendAddress.call(orgDiv.node(), address);
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
				var itemsDiv = cellDiv.append("ol");

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
	
	var addInquiry = function(user)
	{
		groupPath = '#'+organization.getValueID() + '>"Inquiry Access Group"';
		cr.selectAll({path: groupPath,
			done: function(groupPaths)
				{
					cr.addObjectValue('#'+session.getValueID()+">Inquiries",
									  '_user',
									  user,
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
												addMissingAccess(user, "_read", groupPaths[0], "_group", done, asyncFailFunction);
											}
										},
										asyncFailFunction);
				},
			fail: asyncFailFunction 
			});
	}
	
	var tryAddInquiry = function()
	{
		if (cr.signedinUser.getValueID())
		{
			addInquiry(cr.signedinUser);
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
							addInquiry(_this);
						}
					},
					fail: asyncFailFunction});
			};
			var onSigninCanceled = function(eventObject)
			{
			};
			
			$(cr.signedinUser).on("signin.cr", null, panel, onSignin);
			$(cr.signedinUser).on("signinCanceled.cr", null, panel, onSigninCanceled);
			
			$(panel).on("hiding.cr", null, cr.signedinUser, function(eventObject)
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
	
	if (cr.signedinUser.getValueID())
	{
		function done(values)
		{
			checkInquiryFunction(values.length ? values[0].id : null);
		}
		cr.getValues({path: '#'+session.getValueID()+">Inquiries",
			field: "_user",
			value: cr.signedinUser.getValueID(),
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
		var s = '#{0}::reference(Offering)>Sessions>Session'.format(this.marker.instanceID);
		s += ':not(["Registration Deadline"<"{0}"])'.format(todayString);
		s += ':not([End<"{0}"])'.format(todayString);
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

						var sitePanel = showSessionDetails(session, _this.marker, _this.sitePanel.node());
	
						showPanelLeft(sitePanel.node(), unblockClick);
					}
				});

		appendSessionDescriptions(buttons);
		
		this.constrainFoundObjects();
		return buttons;
	}
	
	PickOfferingSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	PickOfferingSearchView.prototype.noResultString = function()
	{
		return "There are no upcoming opportunities for {0}.".format(this.marker.getDescription());
	}
	
	function PickOfferingSearchView(sitePanel, marker)
	{
		this.marker = marker;
		PanelSearchView.call(this, sitePanel, "Search", undefined, GetDataChunker);
	}
	
	return PickOfferingSearchView;
})();

var PickOfferingPanel = (function() {
	PickOfferingPanel.prototype = new SitePanel();
	PickOfferingPanel.prototype.offeringID = null;
	
	function PickOfferingPanel(marker, offeringID, previousPanel) {
		var header = "Find a New Experience";
		SitePanel.call(this, previousPanel, null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
			
		navContainer.appendTitle(header);

		this.searchView = new PickOfferingSearchView(this, marker);
		this.searchView.search("");

		showPanelLeft(this.node(), unblockClick);
	}
	
	return PickOfferingPanel;
})();

var FindExperienceSearchView = (function () {
	FindExperienceSearchView.prototype = new PanelSearchView();
	FindExperienceSearchView.prototype.offeringID = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	FindExperienceSearchView.prototype.onClickButton = function(d, i, button) {
		if (prepareClick('click', 'pick ' + d.typeName + ': ' + d.getDescription()))
		{
			showClickFeedback(button);
			
			var panel = new PickOfferingPanel(d, this.offeringID, this.sitePanel.node());
		}
		d3.event.preventDefault();
	}
	
	FindExperienceSearchView.prototype.fields = function()
	{
		return ["parents", "type"];
	}
	
	/* Overrides SearchView.searchPath */
	FindExperienceSearchView.prototype.searchPath = function(val)
	{
		var s = "Service";
		if (val.length == 0)
			return s;
		else
		{
			if (val.length < 3)
				return s + '[_name^="' + val + '"]';
			else
				return s + '[_name*="' + val + '"]';
		}
	}
	
	FindExperienceSearchView.prototype.isButtonVisible = function(button, d)
	{
		var i = d.getDescription().toLocaleLowerCase().indexOf(this._constrainCompareText);
		if (this._constrainCompareText.length < 3)
			return i == 0;
		else
			return i >= 0;
	}
	
	FindExperienceSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	function FindExperienceSearchView(sitePanel, offeringID) {
		this.offeringID = offeringID;
		PanelSearchView.call(this, sitePanel, "Search", undefined, GetDataChunker);
	}
	
	return FindExperienceSearchView;
})();

var FindExperiencePanel = (function () {
	FindExperiencePanel.prototype = new SitePanel();
	
	function FindExperiencePanel(user, serviceValueID, offeringID, previousPanel) {
		var header = "Find a New Experience";
		SitePanel.call(this, previousPanel, null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
			
		navContainer.appendTitle(header);
		
		this.searchView = new FindExperienceSearchView(this, offeringID);
		this.searchView.search("");

		showPanelLeft(this.node(), unblockClick);
	}
	
	return FindExperiencePanel;
})();
