/* Create a panel to show the details of the session and allow the user to sign up. */
function showSessionDetails(user, session, service, previousPanelNode)
{
	var _this = this;
	
	var organization = session.organization();
	var offering = session.offering();
	var site = session.site();
	
	var sitePanel = new SitePanel();
	sitePanel.createRoot(session, offering.description(), "session");
	var panel = sitePanel.node();
	
	var navContainer = sitePanel.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", function() { sitePanel.hideRightEvent(); });
	backButton.append("span").text(crv.buttonTexts.done);
	
	var buttonDiv = navContainer.appendRightButton();
	
	var shareDiv = null;

	var panel2Div = sitePanel.appendScrollArea();
	panel2Div.appendHeader();
	
	if (organization)
	{
		var orgDiv = panel2Div.append("section");
		orgDiv.classed("organization", true);

		var labelDiv = orgDiv.append("label")
			.text(organization.description());

		if (site.description() && (site.description() !== organization.description()))
		{
			orgDiv.append('div')
				.classed("address-line", true)
				.text(site.description());
		}
		
		site.promiseData()
			.then(function()
				{
					var address = site.address();
					appendAddress.call(orgDiv.node(), address);
				});
	}
	
	function appendStringDatum(cellName, cellData)
	{
		if (cellData)
		{
			var deadlineDiv = panel2Div.append("section");
			appendStringItem(deadlineDiv.node(), cellName, cellData);
			return deadlineDiv;
		}
		else
			return null;
	}
	
	var firstDiv = null;
	var nextDiv;
	firstDiv = appendStringDatum("Registration Deadline", session.registrationDeadline());
	
	nextDiv = appendStringDatum("Start", session.start());
	if (!firstDiv)
		firstDiv = nextDiv;
		
	nextDiv = appendStringDatum("End", session.end());
	if (!firstDiv)
		firstDiv = nextDiv;

	var cellDiv = panel2Div.append("section")
		.classed("cell", true);
	
	offering.promiseData()
		.then(function()
			{
				var offeringServices = offering.offeringServices();
				if (!service && offeringServices.length > 0)
					service = offeringServices[0].service();
				
				if (service)
				{
					shareDiv = sitePanel.appendBottomNavContainer();

					shareDiv.div.classed("share-container border-above", true);

					appendFacebookButton(shareDiv, service, session);
				}

				if (offeringServices.length > 0)
				{
					cellDiv.append('label').text("Tags")
					var itemsDiv = crf.appendItemList(cellDiv);

					var items = appendItems(itemsDiv, offeringServices);
					appendButtonDescriptions(items);
					cellDiv.append("div").classed("cell-border-below", true);
				}
				
				var newText = offering.ageRange();
				if (newText)
				{
					var agesDiv = panel2Div.append("section");
					appendStringItem(agesDiv.node(), "Ages", newText);
				}
				
				var newText = offering.gradeRange();
				if (newText)
				{
					var gradesDiv = panel2Div.append("section");
					appendStringItem(gradesDiv.node(), "Grades", newText);
				}
				
				var newText = offering.webSite();
				if (newText)
				{
					var webSiteDiv = panel2Div.append("section");
					var labelDiv = webSiteDiv.append("div")
						.classed("more-info", true);
					var link = labelDiv
						.append("a")
						.classed("site-active-text", true)
						.attr("href", newText)
						.attr("target", "_blank")
						.text("More Info");
				}
			},
			cr.asyncFail);

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
		groupPath = organization.urlPath() + '/inquiry access group';
		cr.getData({path: groupPath, fields: ['none'], resultType: cr.Group})
			.then(function(groupPaths)
				{
					changes = {'inquiries': [{'add': '1', 'user': user.urlPath() }]};
					var sourceObjects = [new cr.ObjectValue()];
					sourceObjects[0].on('changed.cr', user, function(eventObject)
						{
							var newInquiryID = this.id;
							function done()
							{
							};
							if (groupPaths.length == 0)
								done();
							else {
								addMissingAccess(user, cr.privileges.read, groupPaths[0], cr.fieldNames.group, done, asyncFailFunction);
							}
						});
					return session.update(changes)
						.then(function()
							{
								s = "{2} signed up for {0}/{1}.\n\nLook out for a notice when {3} enrolled."
									.format(offering.description(),
											session.description(),
											user === cr.signedinUser ? "You have" : user.caption() + " has",
											user === cr.signedinUser ? "you are" : user.caption() + " is");
								bootstrap_alert.success(s,
											  ".alert-container");
								checkInquiryFunction(user, newInquiryID); 
							});
				})
			.then(undefined, cr.asyncFail);
	}
	
	var tryAddInquiry = function(user)
	{
		if (user.id())
		{
			addInquiry(user);
			unblockClick();
		}
		else
		{
			var onSignin = function(eventObject)
			{
				var _this = this;
				
				cr.getData({path: "session/{0}/inquiry/user/{1}".format(session.id(), this.id())})
					.then(function(valueIDs)
						{
							if (valueIDs.length > 0)
							{
								checkInquiryFunction(user, valueIDs[0].id);
								bootstrap_alert.success(_this.description() + 
													  " already signed up for " + 
													  offering.description() + "/" + session.description(),
													  ".alert-container");
							}
							else
							{
								addInquiry(_this);
							}
						},
						cr.asyncFail);
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
			
			var successFunction = function()
			{
				bootstrap_alert.success("You have backed out of " + 
							  offering.description() + "/" + session.description() + ".",
							  ".alert-container");
				checkInquiryFunction(user, null);
			}
			
			cr.deleteValue(inquiryValueID)
				.then(successFunction, cr.asyncFail);
			
			unblockClick();
		}
		d3.event.preventDefault();
	};
	
	if (user.id())
	{
		function done(values)
		{
			checkInquiryFunction(user, values.length ? values[0].id : null);
		}
		cr.getData({path: "session/{0}/inquiry/user/{1}".format(session.id(), user.id()),
				    resultType: cr.User})
					.then(done, cr.asyncFail);
	}
	else
		checkInquiryFunction(user, null);
	
	return sitePanel;
}
		
var PickOfferingSearchView = (function () {
	PickOfferingPanel.prototype = Object.create(SitePanel.prototype);
	PickOfferingPanel.prototype.constructor = PickOfferingPanel;

	PickOfferingSearchView.prototype.tag = null;
	PickOfferingSearchView.prototype.user = null;
	
	/* SearchView.prototype.onClickButton 
		onClickButton does not need to be overwritten because showObjects is overwritten. */
	
	/* Overrides SearchView.prototype.isButtonVisible */
	PickOfferingSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		return d.description().toLocaleLowerCase().indexOf(compareText) >= 0 ||
			   d.getValue("Offering").description().toLocaleLowerCase().indexOf(compareText) >= 0 ||
			   d.getValue("Site").description().toLocaleLowerCase().indexOf(compareText) >= 0 ||
			   d.getValue("Organization").description().toLocaleLowerCase().indexOf(compareText) >= 0;
	}
	
	/* Overrides SearchView.searchPath */
	PickOfferingSearchView.prototype.searchPath = function(val)
	{
		var currentDate = new Date();
		var todayString = currentDate.toISOString().substring(0, 10);
		var s = 'offering[service>service={0}]/session'.format(this.tag.id());
		s += '[registration deadline~<"{0}"]'.format(todayString);
		s += '[end~<"{0}"]'.format(todayString);
		if (val.length == 0)
			return s;
		else
		{
			return s + '[name>text*="{0}"]|[offering>name>text*="{0}"]|[offering>site>name>text*="{0}"]|[offering>site>organization>name>text*="{0}"]'
				.format(encodeURIComponent(val));
		}
	}
	
	PickOfferingSearchView.prototype.resultType = function()
	{
		return cr.Session;
	}
	
	PickOfferingSearchView.prototype.showObjects = function(foundObjects)
	{
		var _this = this;
		var sections = this.appendButtonContainers(foundObjects)
			.on("click", function(session)
				{
					if (prepareClick('click', 'show details: ' + session.description()))
					{
						showClickFeedback(this);

						var sitePanel = showSessionDetails(_this.user, session, _this.tag, _this.sitePanel.node());
	
						sitePanel.showLeft()
							.then(unblockClick);
					}
				});

		appendSessionDescriptions(sections);
		
		this.constrainFoundObjects();
		return sections;
	}
	
	PickOfferingSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	PickOfferingSearchView.prototype.noResultString = function()
	{
		return "There are no upcoming opportunities for {0}.".format(this.tag.description());
	}
	
	function PickOfferingSearchView(sitePanel, user, tag)
	{
		this.tag = tag;
		this.user = user;
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return PickOfferingSearchView;
})();

var PickOfferingPanel = (function() {
	PickOfferingPanel.prototype = Object.create(SitePanel.prototype);
	PickOfferingPanel.prototype.constructor = PickOfferingPanel;

	PickOfferingPanel.prototype.offeringID = null;
	
	function PickOfferingPanel(user, tag, offeringID) {
		var _this = this;
		
		var header = "Find a New Experience";
		this.createRoot(null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", function() { _this.hideRightEvent(); })
		    .append("span").text(crv.buttonTexts.done);
			
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
	FindExperienceSearchView.prototype = Object.create(PanelSearchView.prototype);
	FindExperienceSearchView.prototype.constructor = FindExperienceSearchView;

	FindExperienceSearchView.prototype.offeringID = null;
	FindExperienceSearchView.prototype.user = null;
	
	/* Overrides SearchView.prototype.onClickButton */
	FindExperienceSearchView.prototype.onClickButton = function(d, i, button) {
		if (prepareClick('click', 'pick ' + d.constructor.name + ': ' + d.description()))
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
		var s = "service";
		if (val.length == 0)
			return s;
		else
		{
			if (val.length < 3)
				return s + '[name>text^="' + encodeURIComponent(val) + '"]';
			else
				return s + '[name>text*="' + encodeURIComponent(val) + '"]';
		}
	}
	
	FindExperienceSearchView.prototype.resultType = function()
	{
		return cr.Service;
	}
	
	FindExperienceSearchView.prototype.increment = function()
	{
		return 1000;
	}
	
	FindExperienceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		var i = d.description().toLocaleLowerCase().indexOf(compareText);
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
		PanelSearchView.call(this, sitePanel, "Search", GetDataChunker);
	}
	
	return FindExperienceSearchView;
})();

var FindExperiencePanel = (function () {
	FindExperiencePanel.prototype = Object.create(SitePanel.prototype);
	FindExperiencePanel.prototype.constructor = FindExperiencePanel;

	function FindExperiencePanel(user, serviceValueID, offeringID) {
		var _this = this;

		var header = "Find a New Experience";
		this.createRoot(null, header, "list");
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", function() { _this.hideRightEvent(); })
		    .append("span").text(crv.buttonTexts.done);
			
		navContainer.appendTitle(header);
		
		var searchView = new FindExperienceSearchView(this, user, offeringID);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return FindExperiencePanel;
})();
