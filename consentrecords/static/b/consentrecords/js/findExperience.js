/* Create a panel to show the details of the session and allow the user to sign up. */
function showSessionDetails(user, session, service, previousPanelNode)
{
	var _this = this;
	
	var organization = session.getValue("Organization");
	var offering = session.getValue("Offering");
	var site = session.getValue("Site");
	
	session.calculateDescription();
	
	var sitePanel = new SitePanel();
	sitePanel.createRoot(session, offering.getDescription(), "session");
	var panel = sitePanel.node();
	
	var navContainer = sitePanel.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", function() { sitePanel.hideRightEvent(); });
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
		
		site.promiseCellsFromCache()
			.then(function()
				{
					var address = site.getValue("Address");
					appendAddress.call(orgDiv.node(), address);
				});
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
	
	offering.promiseCellsFromCache()
		.then(function()
			{
				var serviceCell = offering.getCell("Service");
				serviceCell.field.label = "Tags";
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
			cr.asyncFail);
	
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
	
	var checkInquiryFunction = function(user, newValueID)
	{
		inquiryValueID = newValueID;
		if (newValueID)
		{
			buttonDiv.text("Back Out");
			buttonDiv.on("click", function() { deleteInquiryFunction.call(this, user); });
		}
		else
		{
			buttonDiv.text("Sign Up");
			buttonDiv.on("click", function() { addNameFunction.call(this, user); });
		}
	};
	
	var addInquiry = function(user)
	{
		groupPath = organization.getInstanceID() + '>"Inquiry Access Group"';
		cr.selectAll({path: groupPath})
			.done(function(groupPaths)
				{
					var initialData = [{
							container: '#{0}>Inquiries'.format(session.getInstanceID()),
							field: cr.fieldNames.user,
							instanceID: user.getInstanceID(),
							description: getUserDescription(user)
						}];
					var sourceObjects = [new cr.ObjectValue()];
					sourceObjects[0].on('dataChanged.cr', user, function(eventObject)
						{
							var newInquiryID = this.id;
							function done()
							{
								s = "{2} signed up for {0}/{1}.\n\nLook out for a notice when {3} enrolled."
									.format(offering.getDescription(),
											session.getDescription(),
											user === cr.signedinUser ? "You have" : getUserDescription(user) + " has",
											user === cr.signedinUser ? "you are" : getUserDescription(user) + " is");
								bootstrap_alert.success(s,
											  ".alert-container");
								checkInquiryFunction(user, newInquiryID); 
							};
							if (groupPaths.length == 0)
								done();
							else {
								addMissingAccess(user, cr.fieldNames.read, groupPaths[0], cr.fieldNames.group, done, asyncFailFunction);
							}
						});
					return cr.updateValues(initialData, sourceObjects);
				})
			.fail(cr.asyncFail);
	}
	
	var tryAddInquiry = function(user)
	{
		if (user.getInstanceID())
		{
			addInquiry(user);
			unblockClick();
		}
		else
		{
			var onSignin = function(eventObject)
			{
				var _this = this;
				
				cr.getValues({path: session.getInstanceID()+">Inquiries",
					field: cr.fieldNames.user,
					value: this.getInstanceID(),
					done: function(valueIDs)
					{
						if (valueIDs.length > 0)
						{
							checkInquiryFunction(user, valueIDs[0].id);
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
			cr.signedinUser.on("signin.cr", panel, onSignin);
			$(panel).on("hiding.cr", null, cr.signedinUser, function(eventObject)
			{
				eventObject.data.off("signin.cr", onSignin);
			});
			
			showFixedPanel(panel, "#id_sign_in_panel");
		}
	}
	
	var addNameFunction = function(user)
	{
		if (prepareClick('click', 'Sign Up'))
		{
			showClickFeedback(this);
			
			tryAddInquiry(user);
		}
		d3.event.preventDefault();
	};
	
	var deleteInquiryFunction = function(user)
	{
		if (prepareClick('click', 'Back Out'))
		{
			showClickFeedback(this);
			
			var successFunction = function(valueID)
			{
				bootstrap_alert.success("You have backed out of " + 
							  offering.getDescription() + "/" + session.getDescription() + ".",
							  ".alert-container");
				checkInquiryFunction(user, null);
			}
			
			cr.deleteValue(inquiryValueID, successFunction, asyncFailFunction);
			
			unblockClick();
		}
		d3.event.preventDefault();
	};
	
	if (user.getInstanceID())
	{
		function done(values)
		{
			checkInquiryFunction(user, values.length ? values[0].id : null);
		}
		cr.getValues({path: session.getInstanceID()+">Inquiries",
			field: cr.fieldNames.user,
			value: user.getInstanceID(),
			done: done,
			fail: asyncFailFunction});
	}
	else
		checkInquiryFunction(user, null);
	
	return sitePanel;
}
		
var PickOfferingSearchView = (function () {
	PickOfferingSearchView.prototype = new PanelSearchView();
	PickOfferingSearchView.prototype.tag = null;
	PickOfferingSearchView.prototype.user = null;
	
	/* SearchView.prototype.onClickButton 
		onClickButton does not need to be overwritten because showObjects is overwritten. */
	
	/* Overrides SearchView.prototype.isButtonVisible */
	PickOfferingSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0 ||
			   d.getValue("Offering").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0 ||
			   d.getValue("Site").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0 ||
			   d.getValue("Organization").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
	}
	
	/* Overrides SearchView.searchPath */
	PickOfferingSearchView.prototype.searchPath = function(val)
	{
		var currentDate = new Date();
		var todayString = currentDate.toISOString().substring(0, 10);
		var s = '#{0}::reference(Offering)>Sessions>Session'.format(this.tag.getInstanceID());
		s += ':not(["Registration Deadline"<"{0}"])'.format(todayString);
		s += ':not([End<"{0}"])'.format(todayString);
		if (val.length == 0)
			return s;
		else if (val.length < 3)
			return s + '[ancestor:name^="' + val + '"]';
		else
			return s + '[ancestor:name*="' + val + '"]';
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

						var sitePanel = showSessionDetails(_this.user, session, _this.tag, _this.sitePanel.node());
	
						sitePanel.showLeft()
							.then(unblockClick);
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
		return "There are no upcoming opportunities for {0}.".format(this.tag.getDescription());
	}
	
	function PickOfferingSearchView(sitePanel, user, tag)
	{
		this.tag = tag;
		this.user = user;
		PanelSearchView.call(this, sitePanel, "Search", undefined, GetDataChunker);
	}
	
	return PickOfferingSearchView;
})();

var PickOfferingPanel = (function() {
	PickOfferingPanel.prototype = new SitePanel();
	PickOfferingPanel.prototype.offeringID = null;
	
	function PickOfferingPanel(user, tag, offeringID) {
		var _this = this;
		
		var header = "Find a New Experience";
		this.createRoot(null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", function() { _this.hideRightEvent(); })
		    .append("span").text("Done");
			
		navContainer.appendTitle(header);

		var searchView = new PickOfferingSearchView(this, user, tag);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
			});

		this.showLeft().then(unblockClick);
	}
	
	return PickOfferingPanel;
})();

var FindExperienceSearchView = (function () {
	FindExperienceSearchView.prototype = new PanelSearchView();
	FindExperienceSearchView.prototype.offeringID = null;
	FindExperienceSearchView.prototype.user = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	FindExperienceSearchView.prototype.onClickButton = function(d, i, button) {
		if (prepareClick('click', 'pick ' + d.getTypeName() + ': ' + d.getDescription()))
		{
			showClickFeedback(button);
			
			var panel = new PickOfferingPanel(this.user, d, this.offeringID);
		}
		d3.event.preventDefault();
	}
	
	FindExperienceSearchView.prototype.fields = function()
	{
		return ["parents"];
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
				return s + '[name^="' + val + '"]';
			else
				return s + '[name*="' + val + '"]';
		}
	}
	
	FindExperienceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		var i = d.getDescription().toLocaleLowerCase().indexOf(compareText);
		if (compareText.length < 3)
			return i == 0;
		else
			return i >= 0;
	}
	
	FindExperienceSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	function FindExperienceSearchView(sitePanel, user, offeringID) {
		this.offeringID = offeringID;
		this.user = user;
		PanelSearchView.call(this, sitePanel, "Search", undefined, GetDataChunker);
	}
	
	return FindExperienceSearchView;
})();

var FindExperiencePanel = (function () {
	FindExperiencePanel.prototype = new SitePanel();
	
	function FindExperiencePanel(user, serviceValueID, offeringID) {
		var _this = this;

		var header = "Find a New Experience";
		this.createRoot(null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", function() { _this.hideRightEvent(); })
		    .append("span").text("Done");
			
		navContainer.appendTitle(header);
		
		var searchView = new FindExperienceSearchView(this, user, offeringID);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return FindExperiencePanel;
})();
