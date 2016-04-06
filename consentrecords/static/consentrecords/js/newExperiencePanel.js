var Experience = (function() {
	Experience.prototype.organization = null;
	Experience.prototype.organizationName = null;
	Experience.prototype.site = null;
	Experience.prototype.siteName = null;
	Experience.prototype.offering = null;
	Experience.prototype.offeringName = null;
	Experience.prototype.services = null;
	Experience.prototype.startDate = null;
	Experience.prototype.endDate = null;
	
	Experience.prototype.setOrganization = function(args) {
		if ("instance" in args)
		{
			var d = args.instance;
			if (d.getValue("Organization"))
			{
				this.organization = d.getValue("Organization");
				this.site = d;
				this.organizationName = d.getValue("Organization").getDescription();
				this.siteName = d.getDescription();
			}
			else
			{
				this.organization = d;
				this.site = null;
				this.organizationName = d.getDescription();
				this.siteName = null;
			}
		}
		else if ("text" in args)
		{
			var textValue = args.text;
			if ((this.site && textValue != this.site.getDescription() && textValue != this.organization.getDescription()) ||
				(!this.site && this.organization && textValue != this.organization.getDescription()) ||
				(!this.site && !this.organization))
			{
				this.organization = null;
				this.site = null;
				this.organizationName = textValue;
				this.siteName = null;
			}
		}
	}
	
	Experience.prototype.setSite = function(args) {
		if ("instance" in args)
		{
			var d = args.instance;
			this.site = d;
			this.siteName = d.getDescription();
		}
		else if ("text" in args)
		{
			var textValue = args.text;
			if ((this.site && textValue != this.site.getDescription()) ||
				!this.site)
			{
				this.site = null;
				this.siteName = textValue;
			}
		}
	}

	Experience.prototype.setOffering = function(args) {
		if ("instance" in args)
		{
			var d = args.instance;
			this.offering = d;
			this.offeringName = d.getDescription();
		}
		else if ("text" in args)
		{
			var textValue = args.text;
			if ((this.offering && textValue != this.offering.getDescription()) ||
				!this.offering)
			{
				this.offering = null;
				this.offeringName = textValue;
			}
		}
	}
	
	Experience.prototype.addService = function(args)
	{
		if ("text" in args)
		{
			var newName = args.text;
			var d = args.instance;
			if (this.services.length > 0)
			{
				var index = this.services.findIndex(function(d) { return d.getDescription() == newName; });
				if (index >= 0)
					this.services.splice(index, 1);

				this.services[0] = new ReportedObject({name: newName, pickedObject: d});
			}
			else if (newName.length > 0)
				this.services.push(new ReportedObject({name: newName, pickedObject: d}));
		}
		else if ("instance" in args)
		{
			var d = args.instance;
			if (this.services.length > 0)
			{
				/* Remove this item if it is farther down in the list. */
				for (var i = 1; i < this.services.length; ++i)
					if (this.services[i].pickedObject == d)
					{
						this.services.splice(i, 1);
						break;
					}
				this.services[0] = new ReportedObject({pickedObject: d});
			}
			else
				this.services.push(new ReportedObject({pickedObject: d}));
		}
	}
	
	Experience.prototype.hasOrganization = function()
	{
		return (this.organizationName && this.organizationName.length);
	}

	Experience.prototype.hasSite = function()
	{
		return (this.siteName && this.siteName.length);
	}

	Experience.prototype.hasOffering = function()
	{
		return (this.offeringName && this.offeringName.length);
	}

	Experience.prototype.hasServices = function()
	{
		return this.offering && this.offering.getCell("Service").data.length > 0 ||
				this.services.length > 0;
	}

	Experience.prototype.appendData = function(initialData)
	{
		if (this.startDate && this.startDate.length > 0)
			initialData["Start"] = [{text: this.startDate}];
		if (this.endDate && this.endDate.length > 0)
			initialData["End"] = [{text: this.endDate}];
		
		if (this.organization)
			initialData["Organization"] = [{instanceID: this.organization.getValueID()}];
		else if (this.organizationName)
			initialData["User Entered Organization"] = [{text: this.organizationName}];
			
		if (this.site)
			initialData["Site"] = [{instanceID: this.site.getValueID()}];
		else if (this.siteName)
			initialData["User Entered Site"] = [{text: this.siteName}];
			
		if (this.offering)
			initialData["Offering"] = [{instanceID: this.offering.getValueID()}];
		else if (this.offeringName)
			initialData["User Entered Offering"] = [{text: this.offeringName}];
			
		for (i = 0; i < this.services.length; ++i)
		{
			var s = this.services[i];
			if (s.pickedObject)
			{
				if (!initialData["Service"])
					initialData["Service"] = [{instanceID: s.pickedObject.getValueID()}];
				else
					initialData["Service"].push({instanceID: s.pickedObject.getValueID()});
			}
			else if (s.name)
			{
				if (!initialData["User Entered Service"])
					initialData["User Entered Service"] = [{text: s.name}];
				else
					initialData["User Entered Service"].push({text: s.name});
			}
		}
	}
	
	Experience.prototype.appendView = function(summary)
	{
		if (this.offeringName)
			summary.append('header').text(this.offeringName);
	
		orgDiv = summary.append('div').classed("organization", true);		
		if (this.organizationName)
			orgDiv.append('div').text(this.organizationName);
			
		if (this.siteName)
			orgDiv.append('div')
				.classed('address-line', true)
				.text(this.siteName);
	
		{
			var startDate = this.startDate;
			var endDate = this.endDate;
			if (startDate && endDate)
				t = startDate + " - " + endDate;
			else if (startDate)
				t = startDate + " - ";
			else if (endDate)
				t = " - " + endDate;
			else
				t = "";
			if (t.length)
			{
				var section = summary.append('section')
					.classed('cell view unique', true);
				section.append('ol')
					.append('li')
					.append('div').classed('string-value-view', true)
					.text(t);
				section.append('div').classed('cell-border-below', true);
			}
		}

		if (this.services.length > 0 || (this.offering && this.offering.getCell("Service").data.length > 0))
		{
			var servicesDiv = summary.append('section')
				.classed('cell view multiple', true);
		
			servicesDiv.append('label').text("Markers");
			var itemsDiv = servicesDiv.append('ol');
		
			if (this.offering)
			{
				appendItems(itemsDiv, this.offering.getCell("Service").data)	
					.append('div')
					.classed('multi-line-item', true)
					.append('div')
					.classed('description-text string-value-view', true)
					.text(function(d) { return d.getDescription(); });
			}
		
			appendItems(itemsDiv, this.services)	
				.append('div')
				.classed('multi-line-item', true)
				.append('div')
				.classed('description-text string-value-view', true)
				.text(function(d) { return d.getDescription(); });
			servicesDiv.append('div').classed("cell-border-below", true);
		}
	}
	
	function Experience()
	{
		this.services = [];
	}
	
	return Experience;
})();

var ExperienceOrganizationSearchView = (function () {
	ExperienceOrganizationSearchView.prototype = new PanelSearchView();
	ExperienceOrganizationSearchView.prototype.experience = null;
	
	ExperienceOrganizationSearchView.prototype.appendDescriptions = function(buttons)
	{
		var leftText = buttons.append('div').classed("left-expanding-div description-text", true);

		leftText.append('div')
			.classed("sub-text", function(d) { return d.getValue("Organization"); })
			.text(function(d) {
				if (d.getValue("Organization"))
					return d.getValue("Organization").getDescription();
				else
					return d.getDescription();
			});
		leftText.append('div')
			.classed("sub-text", true)
			.text(function(d) { 
				if (d.getValue("Organization"))
					return d.getDescription();
				else
					return "";
			});
	}
			
	/* Overrides SearchView.prototype.onClickButton */
	ExperienceOrganizationSearchView.prototype.onClickButton = function(d) {
		if (prepareClick('click', 'pick organization'))
		{
			if (typeof(d) !== "object")
			{
				this.experience.organization = null;
				this.experience.organizationName = d;
			}
			else if (d.typeName === "Site")
			{
				this.experience.organization = d.getValue("Organization");
				this.experience.organizationName = d.getValue("Organization").getDescription();
				this.experience.site = d;
				this.experience.siteName = d.getDescription();
			}
			else
			{
				this.experience.organization = d;
				this.experience.organizationName = d.getDescription();
				this.experience.site = null;
				this.experience.siteName = null;
			}
			this.sitePanel.done();
		}
		d3.event.preventDefault();
	}
	
	/* Overrides SearchView.prototype.isButtonVisible */
	ExperienceOrganizationSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (typeof(d) != "object")
		{
			return compareText.length > 0;
		}
		else
		{
			if (compareText.length === 0)
				return true;
			
			return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
		}
	}
	
	/* Overrides SearchView.searchPath */
	ExperienceOrganizationSearchView.prototype.searchPath = function(val)
	{
		if (val.length == 0)
			return '(Organization,Site)';
		else if (val.length < 3)
			return '(Organization,Site)[_name^="'+val+'"]';
		else
			return '(Organization,Site)[_name*="'+val+'"]';
	}
	
	ExperienceOrganizationSearchView.prototype.showObjects = function(foundObjects)
	{
		var buttons = SearchView.prototype.showObjects.call(this, foundObjects);
			
		if (this.experience.organization)
		{
			var _this = this;
			buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
				function(d) { return typeof(d) == "object" && d == _this.experience.organization; });
		}
		
		this.showCustomButton();
		
		return buttons;
	}
	
	ExperienceOrganizationSearchView.prototype.fields = function()
	{
		var fields = SearchView.prototype.fields.call(this);
		fields.push('type');
		return fields;
	}
	
	ExperienceOrganizationSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	ExperienceOrganizationSearchView.prototype.clearListPanel = function()
	{
		var buttons = this.listPanel.selectAll("li");
		buttons = buttons.filter(function(d, i) { return i > 0; });
			
		buttons.remove();
	}
	
	ExperienceOrganizationSearchView.prototype.showCustomButton = function()
	{
		var val = this.inputText();
		
		var isVisible;
		if (val.length == 0)
			isVisible = false;
		else
		{
			var data = this.listPanel.selectAll("li").data();
			isVisible = !data.find(function(d) { return d.getDescription && d.getDescription() === val; });
		}
		this.organizationButtons.style('display', isVisible ? null : 'none');
	}
	
	ExperienceOrganizationSearchView.prototype.textChanged = function()
	{
		SearchView.prototype.textChanged.call(this);

		var val = this.inputText();
		
		this.organizationButtons.selectAll('.description-text').text('"{0}"'.format(val));
		this.showCustomButton();
	}
	
	function ExperienceOrganizationSearchView(sitePanel, experience)
	{
		if (sitePanel)
		{
			this.experience = experience;
			var _this = this;
			PanelSearchView.call(this, sitePanel, "Organization", this.appendDescriptions, GetDataChunker);
			
			var sections = this.appendButtonContainers(["Organization"]);
			this.organizationButtons = appendViewButtons(sections, 
						function(buttons)
						{
							var leftText = buttons.append('div').classed("left-expanding-div description-text", true);
							leftText.text("");
						}
				)
				.on("click", function(d, i) {
					if (prepareClick('click', 'Set Custom Organization'))
					{
						experience.organization = null;
						experience.organizationName = _this.inputText();
						experience.site = null;
						experience.siteName = null;
						_this.sitePanel.done();
					}
				});
			this.organizationButtons.style("display", "none");
		}
		else
			PanelSearchView.call(this);
	}
	
	return ExperienceOrganizationSearchView;
})();

var ExperienceOrganizationPanel = (function () {
	ExperienceOrganizationPanel.prototype = new SitePanel();
	ExperienceOrganizationPanel.prototype.navContainer = null;
	ExperienceOrganizationPanel.prototype.searchView = null;
	ExperienceOrganizationPanel.prototype.done = null;
	ExperienceOrganizationPanel.prototype.experience = null;
	
	ExperienceOrganizationPanel.prototype.onClickCancel = function()
	{
		if (prepareClick('click', 'Cancel'))
		{
			this.hide();
		}
		d3.event.preventDefault();
	}
	
	ExperienceOrganizationPanel.prototype.getTitle = function()
	{
		return "Add Experience";
	}
	
	ExperienceOrganizationPanel.prototype.createSearchView = function()
	{
		return new ExperienceOrganizationSearchView(this, this.experience);
	}
	
	function ExperienceOrganizationPanel(previousPanelNode, experience, done)
	{
		if (previousPanelNode === undefined)
		{
			SitePanel.call(this);
		}
		else
		{
			SitePanel.call(this, previousPanelNode, experience, "Add Experience", "list");
			this.experience = experience;
			this.done = done;
			this.navContainer = this.appendNavContainer();

			var _this = this;
			var backButton = this.navContainer.appendLeftButton()
				.on("click", function()
				{
					_this.onClickCancel();
				});
			backButton.append("span").text("Cancel");
			
			var title = this.getTitle();
			if (title)
				this.navContainer.appendTitle(title);
			
			this.searchView = this.createSearchView();
			this.searchView.inputText(experience.organizationName || "");
			this.searchView.textChanged();
		}
	}
	return ExperienceOrganizationPanel;
})();

var DotsSearchView = (function() {
	DotsSearchView.prototype = new SearchView();
	DotsSearchView.prototype.dots = null;
	DotsSearchView.prototype.container = null;
	
	DotsSearchView.prototype.appendSearchArea = function()
	{
		var section = this.container.append("section")
			.classed("multiple list-container", true);
		
		var f = function(eventObject)
			{
				$(eventObject.data).calculateFillHeight();
			};
			
		$(this.dots.div.node().parentNode).on('resize.cr', null, section.node(), f);
		$(section.node()).on("remove", function()
			{
				$(this.dots.div.node().parentNode).off('resize.cr', null, f);
			});
			
		$(section.node()).calculateFillHeight();	
		return section.append("ol");
	}
	
	function DotsSearchView(dots, container, placeholder, appendDescriptions)
	{
		this.dots = dots;
		this.container = container;
		if (container)
			SearchView.call(this, container.node(), placeholder, appendDescriptions, GetDataChunker);
		else
			SearchView.call(this);
	}
	
	return DotsSearchView;
})();

var ServiceDomainSearchView = (function() {
	ServiceDomainSearchView.prototype = new DotsSearchView();
	
	ServiceDomainSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'service domain: ' + d.getDescription()))
		{
			this.dots.experience.serviceDomain = d;
			this.dots.setValue(NewExperiencePanelIndexes.service);
		}
		d3.event.preventDefault();
	}
	
	ServiceDomainSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		if (d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
			return true;
		return false;
	}
	
	ServiceDomainSearchView.prototype.searchPath = function(val)
	{
		var path = '"Service Domain"';
			
		if (val.length == 0)
			return path;
		else if (val.length < 3)
			return '{1}[_name^="{0}"]'.format(val, path);
		else
			return '{1}[_name*="{0}"]'.format(val, path);
	}
	
	function ServiceDomainSearchView(dots, container, placeholder)
	{
		DotsSearchView.call(this, dots, container, placeholder)
		
		$(this.getDataChunker).on("dataLoaded.cr", function()
			{
				if (!dots.experience.hasOrganization())
				{
					var sections = this.appendButtonContainers(["Organization"]);
					this.organizationButtons = appendViewButtons(sections, 
								function(buttons)
								{
									var leftText = buttons.append('div').classed("left-expanding-div description-text", true);

									leftText.append('div')
										.text("Search By Organization");
								}
						)
						.on("click", function(d, i) {
							if (prepareClick('click', 'Search By Organization'))
							{
								dots.setValue(NewExperiencePanelIndexes.organization);
							}
						});
				}
		
				if (!dots.experience.hasOffering())
				{
					sections = this.appendButtonContainers(["Offering"]);
					this.offeringButtons = appendViewButtons(sections,  
								function(buttons)
								{
									var leftText = buttons.append('div').classed("left-expanding-div description-text", true);

									leftText.append('div')
										.text("Search By Offering");
								}
						)
						.on("click", function(d, i) {
							if (prepareClick('click', 'Search By Offering'))
							{
								dots.setValue(NewExperiencePanelIndexes.offering);
							}
						});
				}
			});
	}
	
	return ServiceDomainSearchView;
})();

var ServiceSearchView = (function() {
	ServiceSearchView.prototype = new DotsSearchView();
	
	ServiceSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'service: ' + d.getDescription()))
		{
			this.dots.experience.addService({instance: d});
			this.dots.setValue(NewExperiencePanelIndexes.fromService);
		}
		d3.event.preventDefault();
	}
	
	ServiceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		if (d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
			return true;
		return false;
	}
	
	ServiceSearchView.prototype.searchPath = function(val)
	{
		var path = '#{0}::reference(Service)'.format(this.dots.experience.serviceDomain.getValueID());
			
		if (val.length == 0)
			return path;
		else if (val.length < 3)
			return '{1}[_name^="{0}"]'.format(val, path);
		else
			return '{1}[_name*="{0}"]'.format(val, path);
	}
	
	ServiceSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	function ServiceSearchView(dots, container, placeholder)
	{
		DotsSearchView.call(this, dots, container, placeholder)
	}
	
	return ServiceSearchView;
})();

var FromServiceSearchView = (function() {
	FromServiceSearchView.prototype = new DotsSearchView();
	FromServiceSearchView.prototype.typeName = "";
	
	FromServiceSearchView.prototype.appendDescriptions = function(buttons)
	{
		var leftText = buttons.append('div').classed("left-expanding-div description-text", true);

			leftText.append('header').text(function(d) { return d.getDescription(); });
	
		orgDiv = leftText.append('div').classed("organization", true);		
		orgDiv.append('div').text(function(d) { return d.getValue("Organization").getDescription(); });
		orgDiv.append('div')
			.classed('address-line', true)
			.text(function(d) { return d.getValue("Site").getDescription(); });
	}
			
	FromServiceSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'service: ' + d.getDescription()))
		{
			this.dots.experience.setOffering({instance: d});
			/* Set the organization, then the site, because setting the organization may
				also set the site.
			 */
			this.dots.experience.setOrganization({instance: d.getValue("Organization")});
			this.dots.experience.setSite({instance: d.getValue("Site")});
			this.dots.experience.services = [];
			this.dots.setValue(NewExperiencePanelIndexes.startDate);
		}
		d3.event.preventDefault();
	}
	
	FromServiceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (d === "Organization")
		{
			return true;
		}
		else
		{
			if (compareText.length === 0)
				return true;
				
			if (d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			if (d.getValue("Site").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			if (d.getValue("Organization").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			return false;
		}
	}
	
	FromServiceSearchView.prototype.searchPath = function(val)
	{
		var path;
		
		if (this.dots.experience.organizationName != null &&
			this.dots.experience.organization == null)
		{
			return "";	/* Can't look up offerings for a custom organization name. */
		}
		else if (val.length == 0)
		{
			path = '#{0}::reference(Offering)';
			if (this.dots.experience.organization)
				path = path + "::and(#{0}>Sites>Site>Offerings>Offering)".format(this.dots.experience.organization.getValueID());
				
			return path.format(this.dots.experience.services[0].pickedObject.getValueID());
		}
		else
		{
			if (this.typeName === "Offering")
				path = '#{0}::reference(Offering)[_name{1}"{2}"]';
			else if (this.typeName === "Site")
			{
				path = '#{0}::reference(Offering)::and(Site[_name{1}"{2}"]>Offerings>Offering)';
			}
			else if (this.typeName === "Organization")
			{
				path = '#{0}::reference(Offering)::and(Organization[_name{1}"{2}"]>Sites>Site>Offerings>Offering)';
			}

			if (this.dots.experience.organization)
				path = path + "::and(#{0}>Sites>Site>Offerings>Offering)".format(this.dots.experience.organization.getValueID());

			var symbol = val.length < 3 ? "^=" : "*=";
			
			return path.format(this.dots.experience.services[0].pickedObject.getValueID(), symbol, val);
		}
	}
	
	FromServiceSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.typeName = "Offering";
		this.startSearchTimeout("");
	}
	
	FromServiceSearchView.prototype.noResultString = function()
	{
		if (this.typeName === "Organization" || !this._foundCompareText || this._foundCompareText.length == 0)
			return "No Results";
		else
			return "";
	}
	
	FromServiceSearchView.prototype.fields = function()
	{
		var fields = SearchView.prototype.fields.call(this);
		fields.push('type');
		return fields;
	}
	
	FromServiceSearchView.prototype.search = function(val)
	{
		this.typeName = "Offering";
		DotsSearchView.prototype.search.call(this, val);
	}
	
	FromServiceSearchView.prototype.clearListPanel = function()
	{
		var buttons = this.listPanel.selectAll("li");
		if (this.organizationButtons)
			buttons = buttons.filter(function(d) { return d !== "Organization"; });
			
		buttons.remove();
	}
	
	function FromServiceSearchView(dots, container, placeholder)
	{
		var _this = this;
		this.typeName = "Offering";
		
		DotsSearchView.call(this, dots, container, placeholder, function(buttons) { _this.appendDescriptions(buttons); });
				
		var sections = this.appendButtonContainers(["Organization"]);
		this.organizationButtons = appendViewButtons(sections, 
					function(buttons)
					{
						var leftText = buttons.append('div').classed("left-expanding-div description-text", true);

						leftText.append('div')
							.text("Search By Organization");
					}
			)
			.on("click", function(d, i) {
				if (prepareClick('click', 'Search By Organization'))
				{
					var panel = new ExperienceOrganizationPanel($(dots.div.node()).parents(".site-panel")[0], _this.dots.experience,
						function()
						{
							_this.experienceView.selectAll('*').remove();
							_this.dots.experience.appendView(_this.experienceView);
							_this.textChanged();
							panel.hide();
						});
					showPanelLeft(panel.node(), unblockClick);
				}
			});

		$(this.getDataChunker).on("dataLoaded.cr", function()
			{
				var searchText = _this._foundCompareText;
				if (searchText && searchText.length > 0)
				{
					if (_this.typeName === "Offering")
					{
						_this.typeName = "Site";
					}
					else if (_this.typeName === "Site")
					{
						_this.typeName = "Organization";
					}
					else
						return;
					
					this.path = _this.searchPath(searchText);
					this.fields = _this.fields();
					this.start(searchText);
				}			
			});
			
		

	}
	
	return FromServiceSearchView;
})();

var OrganizationSearchView = (function() {
	OrganizationSearchView.prototype = new SearchView();
	OrganizationSearchView.prototype.dots = null;
	OrganizationSearchView.prototype.container = null;
	
	OrganizationSearchView.prototype.appendDescriptions = function(buttons)
	{
		var leftText = buttons.append('div').classed("left-expanding-div", true);

		leftText.append('div')
			.classed("sub-text", function(d) { return d.getValue("Organization"); })
			.text(function(d) {
				if (d.getValue("Organization"))
					return d.getValue("Organization").getDescription();
				else
					return d.getDescription();
			});
		leftText.append('div')
			.classed("sub-text", true)
			.text(function(d) { 
				if (d.getValue("Organization"))
					return d.getDescription();
				else
					return "";
			});
	}
			
	OrganizationSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'experience organization: ' + d.getDescription()))
		{
			this.dots.experience.setOrganization({instance: d});

			this.inputBox.value = d.getDescription();
			$(this.inputBox).trigger("input");
			if (this.dots.experience.site)
				this.dots.setValue(this.dots.value + 2);
			else
				this.dots.setValue(this.dots.value + 1);
		}
		d3.event.preventDefault();
	}
	
	OrganizationSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		if (d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
			return true;
		return false;
	}
	
	OrganizationSearchView.prototype.searchPath = function(val)
	{
		if (val.length == 0)
			return "";
		else if (val.length < 3)
			return '(Organization,Site)[_name^="'+val+'"]';
		else
			return '(Organization,Site)[_name*="'+val+'"]';
	}
	
	OrganizationSearchView.prototype.appendSearchArea = function()
	{
		var w = this.container.append('div').classed('body', true)
				  .append('div')
				  .append('div');
		return w.append("section")
			.classed("multiple", true)
			.append("ol");
	}
	
	function OrganizationSearchView(dots, container, placeholder)
	{
		this.dots = dots;
		this.container = container;
		SearchView.call(this, container.node(), placeholder, this.appendDescriptions, GetDataChunker)
	}
	
	return OrganizationSearchView;
})();

var SiteSearchView = (function() {
	SiteSearchView.prototype = new SearchView();
	SiteSearchView.prototype.dots = null;
	SiteSearchView.prototype.container = null;
	
	SiteSearchView.prototype.appendDescriptions = function(buttons)
	{
		buttons.append("div")
			.classed("description-text", true)
			.text(_getDataDescription)
			.each(_pushTextChanged);
		buttons.each(function(site)
		{
			var _button = this;
			var address = site.getValue("Address");
			appendAddress.call(this, address);
		});
	}
			
	SiteSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'experience site: ' + d.getDescription()))
		{
			this.dots.experience.setSite({instance: d});

			this.inputBox.value = d.getDescription();
			$(this.inputBox).trigger("input");
			this.dots.setValue(this.dots.value + 1);
		}
		d3.event.preventDefault();
	}
	
	SiteSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		var retVal = false;
		if (compareText.length === 0)
			return true;
			
		d3.select(button).selectAll('div').each(function()
			{
				retVal |= d3.select(this).text().toLocaleLowerCase().indexOf(compareText) >= 0;
			});
		return retVal;
	}
	
	SiteSearchView.prototype.searchPath = function(val)
	{
		if (!this.dots.experience.organization)
			return "";
			
		var s = "#"+this.dots.experience.organization.getValueID() + ">Sites>Site";
		if (val.length == 0)
			return s;
		else if (val.length < 3)
			return s + '[_name^="'+val+'"]';
		else
			return s + '[_name*="'+val+'"]';
	}
	
	SiteSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		if (this.dots.experience.organization)
		{
			this.startSearchTimeout("");
		}
	}
	
	SiteSearchView.prototype.fields = function()
	{
		return ["Address"];
	}
	
	SiteSearchView.prototype.appendSearchArea = function()
	{
		var w = this.container.append('div').classed('body', true)
				  .append('div')
				  .append('div');
		return w.append("section")
			.classed("multiple", true)
			.append("ol");
	}
	
	function SiteSearchView(dots, container, placeholder)
	{
		this.dots = dots;
		this.container = container;
		SearchView.call(this, container.node(), placeholder, this.appendDescriptions, GetDataChunker)
	}
	
	return SiteSearchView;
})();

/* A reported object combines a name and an object value that might be picked. */
var ReportedObject = function () {
	ReportedObject.prototype.name = null;
	ReportedObject.prototype.pickedObject = null;
	
	function ReportedObject(args) {
		if (!("name" in args)) args.name = null;
		if (!("pickedObject" in args)) args.pickedObject = null;
		
		this.name = args.name;
		this.pickedObject = args.pickedObject;
    };
    
    ReportedObject.prototype.getDescription = function()
    {
    	if (this.pickedObject) return this.pickedObject.getDescription();
    	return this.name;
    }
    
    return ReportedObject;
}();

var PickServicePanel = (function () {
	PickServicePanel.prototype = new SitePanel();
	
	PickServicePanel.prototype.getObjectByDescription = function(a, description)
	{
		for (var i = 0; i < a.length; ++i)
		{
			if (a[i].getDescription() == description)
				return a[i];
		}
		return null;
	}

	function PickServicePanel(previousPanelNode, rootObjects, oldReportedObject, dots, success)
	{
		var header = oldReportedObject ? "Marker" : "New Marker";
		SitePanel.call(this, previousPanelNode, rootObjects, header, "list");
		var _this = this;

		var navContainer = _this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'cancel'))
				{
					hidePanelRight(_this.node());
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
	
		var addButton = navContainer.appendRightButton()
			.on("click", function()
			{
				if (prepareClick('click', 'add service'))
				{
					if (!dots.getServiceByName(searchInputNode.value))
					{
						var newValue = _this.getObjectByDescription(rootObjects, searchInputNode.value);
						success(new ReportedObject({name: searchInputNode.value, pickedObject: newValue}));
					}
				
					hidePanelRight(_this.node());
				}
				d3.event.preventDefault();
			});
		addButton.append('span').text(oldReportedObject ? 'Change' : 'Add');
		addButton.classed("site-disabled-text", true);
		addButton.classed("site-active-text", false);
	
		navContainer.appendTitle(header);
	
		var textChanged = function(){
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
		
			addButton.classed("site-disabled-text", val.length == 0);
			addButton.classed("site-active-text", val.length > 0);
		}

		var searchInputNode = _this.appendSearchBar(textChanged);

		var panel2Div = _this.appendScrollArea();
	
		function buttonClicked(d) {
			if (prepareClick('click', 'pick service: ' + d.getDescription()))
			{
				success(new ReportedObject({pickedObject: d}));
				hidePanelRight(_this.node());
			}
			d3.event.preventDefault();
		}
	
		var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
	
		if (oldReportedObject)
		{
			if (oldReportedObject.pickedObject)
			{
				buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
					function(d) { return d == oldReportedObject.pickedObject; });
			}
			else
			{
				searchInputNode.value = oldReportedObject.getDescription();
				$(searchInputNode).trigger("input");
			}
		}
	
		showPanelLeft(_this.node(), unblockClick);
	}

	return PickServicePanel;
})();

var NewExperiencePanel = (function () {
	NewExperiencePanel.prototype = new SitePanel();
	
	NewExperiencePanel.prototype.addInput = function(p, placeholder)
	{
		var searchBar = p.append("div").classed("searchbar", true);
	
		var searchInputContainer = searchBar.append("div")
			.classed("search-input-container", true);
		
		return searchInputContainer
			.append("input")
			.classed("search-input", true)
			.attr("placeholder", placeholder);
	}

	NewExperiencePanel.prototype.setupPanel2 = function(dots)
	{
		var p = d3.select(this);
		
		var searchView = new ServiceDomainSearchView(dots, p);
		searchView.search("");
		
		this.onReveal = null;
	}

	NewExperiencePanel.prototype.setupPanel3 = function(dots)
	{
		var p = d3.select(this);
		
		var searchView = new ServiceSearchView(dots, p);

		var next = function()
		{
			searchView.clearListPanel();
			searchView.search(searchView.inputCompareText());				
		};

		next.call(this);
		this.onReveal = next;
	}

	NewExperiencePanel.prototype.setupFromServicePanel = function(dotsPanel, dots)
	{
		var p = d3.select(dotsPanel);
		
		experienceView = p.append('div');
		
		var searchView = new FromServiceSearchView(dots, p, "Place, Offering");
		searchView.experienceView = experienceView;
		dots.experience.appendView(experienceView);
		
		var next = function()
		{
			searchView.clearListPanel();
			searchView.typeName = "Offering";
			searchView.search(searchView.inputCompareText());				
		};

		next.call(this);
		dotsPanel.onReveal = next;
	}

	NewExperiencePanel.prototype.setupStartDatePanel = function(dots)
	{
		var p = d3.select(this);
		p.append('div')
			.append('p').text("When did you start " + dots.experience.offeringName + "?");

		var minYear = undefined;
		var startDateInput;
		
		var birthday = dots.user.getDatum("Birthday");
		if (birthday)
			minYear = parseInt(birthday.substr(0, 4));

		startDateInput = new DateInput(this, new Date(birthday));
		
		$(startDateInput).on('change', function(eventObject) {
			dots.checkForwardEnabled();
		});
		
		this.onCheckForwardEnabled = function()
		{
			return startDateInput.year && startDateInput.month;
		}
			
		this.onDoneClicked = function()
		{
			dots.experience.startDate = startDateInput.value();
		}

		this.onReveal = null;
	}
	
	NewExperiencePanel.prototype._getMinEndDate = function(dots)
	{
		if (dots.experience.startDate && dots.experience.startDate.length > 0)
			return new Date(dots.experience.startDate);
		else
		{
			var birthday = dots.user.getDatum("Birthday");
			if (birthday)
				return new Date(birthday);
		}
		return undefined;
	}

	NewExperiencePanel.prototype.setupEndDatePanel = function(dotsPanel, dots)
	{
		var p = d3.select(dotsPanel);
		var _this = this;
		var endDateInput;
		
		p.append('div')
			.append('p').text("When did you finish " + dots.experience.offeringName + "?");
		p.append('div')
			.append('p').classed('site-active-text', true)
			.on('click', function()
				{
					if (prepareClick('click', "It isn't finished."))
					{
						endDateInput.clear();
						dotsPanel.onGoingForward();
					}
				})
			.text("It isn't finished.");

		endDateInput = new DateInput(dotsPanel, this._getMinEndDate(dots))

		dotsPanel.onGoingForward = function(goToNext)
		{
			if (dots.experience.hasServices())
				dots.setValue(dots.value + 2);
			else
				dots.setValue(dots.value + 1);
		}
		
		dotsPanel.onDoneClicked = function()
		{
			dots.experience.endDate = endDateInput.value();
		}

		dotsPanel.onReveal = function(dots)
		{
			endDateInput.checkMinDate(_this._getMinEndDate(dots))
		}
	}
	
	NewExperiencePanel.prototype.setupConfirmPanel = function(dots)
	{
		var p = d3.select(this);
	
		p.selectAll("*").remove();
	
		var p = d3.select(this)
			.classed('confirm-experience', true);
	
		p.append('div')
			.append('p').text("Add this experience to your pathway?");

		var summary = p.append('div')
			.classed('summary body', true)
			.append('div')
			.append('div');
		dots.experience.appendView(summary);
	}

	NewExperiencePanel.prototype.setupFirstMarkerPanel = function(dotsPanel, dots)
	{
		var p0 = d3.select(dotsPanel);
		p0.append('div')
			.append('p').text("Every experience leaves some marker along your pathway that describes what you got from that experience.");
		p0.append('div')
			.append('p').text("Choose one of the markers below, or create your own marker. If more than one marker applies, pick one and then you can add others.");
		
		var searchInput = this.addInput(p0, "Experience");
	
		var lastText = "";	
		$(searchInput.node()).on("keyup input paste", function(e) {
			if (lastText != this.value)
			{
				lastText = this.value;
				if (lastText.length == 0)
				{
					/* Show all of the items. */
					p0.selectAll("li")
						.style("display", "block");
				}
				else
				{
					/* Show the items whose description is this.value */
					p0.selectAll("li")
						.style("display", function(d)
							{
								if (d.getDescription().toLocaleLowerCase().indexOf(lastText.toLocaleLowerCase()) >= 0)
									return null;
								else
									return "none";
							});
				}
			}
		});

		function done(rootObjects)
		{
			function sortByDescription(a, b)
			{
				return a.getDescription().localeCompare(b.getDescription());
			}

			function buttonClicked(d)
			{
				if (prepareClick('click', 'experience first marker: ' + d.getDescription()))
				{
					experience.addService({instance: d});
			
					searchInput.node().value = d.getDescription();
					$(searchInput.node()).trigger("input");
					dots.setValue(dots.value + 1);
				}
			}
		
			rootObjects.sort(sortByDescription);
			p0.datum(rootObjects);
			var w = p0.append('div').classed('body', true)
					  .append('div')
					  .append('div');
			appendButtons(w, rootObjects, buttonClicked);
		}
	
		p0.node().onDoneClicked = function()
		{
			var newName = searchInput.node().value.trim();
		
			/* Identify if the new name matches the name of an existing service. */
			var rootObjects = p0.datum();
			var newValue = rootObjects.find(function(d) { return d.getDescription() == newName; });
			
			dots.experience.addService({text: newName, instance: newValue});
		}
		crp.getData({path: "Service", done: done, fail: asyncFailFunction});
		dotsPanel.onReveal = null;
	}

	NewExperiencePanel.prototype.setupServicesPanel = function(dots)
	{
		var sitePanelNode = $(this).parents("panel.site-panel")[0];
		var p1 = d3.select(this);
		var header = p1.append('div')
			.append('p');
		
		if (dots.experience.offering && dots.experience.offering.getCell("Service").data.length > 0)
			header.text("Markers indicate the type or the benefit of this experience.");
		else
			header.text("Some experiences need more than one marker, such as being the captain of a soccer team or getting a summer job working with computers.");

		var obj = p1.append('div')
			.classed('body', true)
			.append('div')
			.append('section')
			.classed("cell multiple", true);
		
		var labelDiv = obj.append('label')
			.text("Markers");
		
		var itemsDiv = obj.append("ol").classed("panel-fill", true);

		itemsDiv.classed("border-above", true);

		var clickFunction;
		clickFunction = function(d) {
				var _this = this;
				if (prepareClick('click', 'marker: ' + d.getDescription()))
				{
					crp.getData({path: "Service", 
					done: function(rootObjects)
					{
						var success = function(newReportedObject)
						{
							var divs = d3.select($(_this).parents("li")[0]);
							/* Set the datum for the li and this object so that the correct object is used in future clicks. */
							divs.datum(newReportedObject);
							d3.select(_this).datum(newReportedObject);
							var s = divs.selectAll(".description-text").text(newReportedObject.getDescription());
							dots.experience.services[dots.experience.services.indexOf(d)] = newReportedObject;
						}
						new PickServicePanel(sitePanelNode, rootObjects, d, dots, success);
					}, 
					fail: syncFailFunction});
				}
			};
	
		function appendOfferingServices()
		{
			if (dots.experience.offering != null)
			{
				var fixedDivs = appendItems(itemsDiv, dots.experience.offering.getCell("Service").data);
				var itemDivs = fixedDivs.append("div")
					.classed("multi-row-content", true)
				appendButtonDescriptions(itemDivs);
			}
		}
	
		function _confirmDeleteClick(d)
		{
			var a = dots.experience.services;
			a.splice($.inArray(d, a), 1);
			var item = $(this).parents("li")[0];
			$(item).animate({height: "0px"}, 200, 'swing', function() { $(item).remove(); });
		}

		function appendServices(services)
		{
			var divs = appendItems(itemsDiv, services);
			appendConfirmDeleteControls(divs)
				.on('click', _confirmDeleteClick);
		
			var buttons = appendRowButtons(divs);
			buttons.on("click", clickFunction);
			appendDeleteControls(buttons);
			appendRightChevrons(buttons);
			appendButtonDescriptions(buttons);
		}
	
		appendOfferingServices();
		appendServices(dots.experience.services);
	
		/* Add one more button for the add Button item. */
		var buttonDiv = obj.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(cell) {
				var _thisButton = this;
				if (prepareClick('click', 'add marker'))
				{
					crp.getData({path: "Service", 
					done: function(rootObjects)
					{
						var success = function(newReportedObject)
						{
							dots.experience.services.push(newReportedObject);
							appendServices([newReportedObject]);
						}
						new PickServicePanel(sitePanelNode, rootObjects, null, dots, success);
					}, 
					fail: syncFailFunction});
				}
				d3.event.preventDefault();
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add marker");
	
		this.onReveal = function()
		{
			itemsDiv.selectAll('li').remove();
			appendOfferingServices();
			appendServices(dots.experience.services);
		}
	
		this.onGoingBack = function()
		{
			if (dots.experience.hasServices())
				dots.setValue(dots.value - 2);
			else
				dots.setValue(dots.value - 1);
		}		
	}

	function NewExperiencePanel(pathway, previousPanelNode) {
		var header = "Add Experience";
		SitePanel.call(this, previousPanelNode, null, header, "edit new-experience-panel");
			
		var navContainer = this.appendNavContainer();

		var panel2Div = this.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		var dots = new DotsNavigator(panel2Div, 8);	
		dots.finalText = "Add";
		dots.user = pathway.user;
		dots.experience = new Experience();

		var _this = this;
		var onAddClick = function()
			{
				bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

				var moreExperiencesObject = dots.user.getValue("More Experiences");
				
				function successFunction3(newData)
				{
					crp.pushCheckCells(newData, undefined, 
						function() {
							function addExperience() {
								pathway.addMoreExperience.call(pathway, newData);
								_this.hidePanelDown();
							}
							var offering = newData.getValue("Offering");
							if (offering && offering.getValueID() && !offering.isDataLoaded)
								crp.pushCheckCells(offering, undefined, addExperience, syncFailFunction);
							else
								addExperience();
						},
						syncFailFunction);
				}
				
				function successFunction2(newData)
				{
					if (newData != moreExperiencesObject)
					{
						var cell = dots.user.getCell("More Experiences");
						cell.addValue(newData);
						moreExperiencesObject = dots.user.getValue("More Experiences");
					}
					
					field = {ofKind: "More Experience", name: "More Experience"};
					var initialData = {};

					dots.experience.appendData(initialData);
					
					cr.createInstance(field, moreExperiencesObject.getValueID(), initialData, successFunction3, syncFailFunction);
				}
				
				if (moreExperiencesObject && moreExperiencesObject.getValueID())
				{
					successFunction2(moreExperiencesObject);
				}
				else
				{
					field = {ofKind: "More Experiences", name: "More Experiences"};
					cr.createInstance(field, dots.user.getValueID(), [], successFunction2, syncFailFunction);
				}
			};

		dots.appendForwardButton(navContainer, onAddClick);
		dots.appendBackButton(navContainer, function() {
			_this.hidePanelDown();
		});
		
		navContainer.appendTitle(header);
		
		dots.nthPanel(0).onReveal = this.setupPanel2;
		dots.nthPanel(1).onReveal = this.setupPanel3;
		dots.nthPanel(2).onReveal = function(dots) { _this.setupFromServicePanel(this, dots); };
		dots.nthPanel(3).onReveal = this.setupStartDatePanel;
		dots.nthPanel(4).onReveal = function(dots) { _this.setupEndDatePanel(this, dots); };
		dots.nthPanel(5).onReveal = function(dots) { _this.setupFirstMarkerPanel(this, dots); };
		dots.nthPanel(6).onReveal = this.setupServicesPanel;
		dots.nthPanel(7).onReveal = this.setupConfirmPanel;
				
		showPanelUp(this.node(), unblockClick);
		dots.showDots();
	}
	
	return NewExperiencePanel;
})();

var NewExperiencePanelIndexes =
	{
		serviceDomain: 0,
		service: 1,
		fromService: 2,
		organization: 3,
		offering: 4,
		startDate: 3,
		endDate: 4,
		
	};
