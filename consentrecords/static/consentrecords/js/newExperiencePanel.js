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
	
	Experience.prototype.clearOrganization = function()
	{
		this.organization = null;
		this.site = null;
		this.organizationName = null;
		this.siteName = null;
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

	Experience.prototype.clearSite = function()
	{
		this.site = null;
		this.siteName = null;
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
	
	Experience.prototype.clearOffering = function()
	{
		this.offering = null;
		this.offeringName = null;
	}
	
	Experience.prototype.addService = function(args)
	{
		if ("text" in args)
		{
			var newName = args.text;
			var d = args.instance;
			var service = new ReportedObject({name: newName, pickedObject: d});
			if (this.services.length > 0)
			{
				var index = this.services.findIndex(function(d) { return d.getDescription() == newName; });
				if (index >= 0)
					this.services.splice(index, 1);

				this.services[0] = service;
				return service;
			}
			else if (newName.length > 0)
			{
				this.services.push(service);
				return service;
			}
		}
		else if ("instance" in args)
		{
			var d = args.instance;
			var service = new ReportedObject({pickedObject: d})
			if (this.services.length > 0)
			{
				/* Remove this item if it is farther down in the list. */
				for (var i = 1; i < this.services.length; ++i)
					if (this.services[i].pickedObject == d)
					{
						this.services.splice(i, 1);
						break;
					}
				this.services[0] = service;
			}
			else
			{
				this.services.push(service);
			}
			return service;
		}
	}
	
	Experience.prototype.removeService = function(service)
	{
		var index = this.services.indexOf(service);
		if (index >= 0)
			this.services.splice(index, 1);
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
		else if (this.services.length > 0)
			initialData["User Entered Offering"] = [{text: this.services[0].getDescription()}];
			
		for (i = (this.offering || this.offeringName ||
				  (this.services.length > 0 && this.services[0].pickedObject)) ? 0 : 1; 
			i < this.services.length; ++i)
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
	
	Experience.prototype.getServiceByName = function(name)
	{
		for (i = 0; i < this.services.length; ++i)
		{
			if (this.services[i].getDescription() == name)
				return this.services[i];
		}
		return null;
	}
	
	Experience.prototype.getMarkerList = function()
	{
		var names = [];
	
		var offering = this.offering;
		if (offering && offering.getValueID())
		{
			names = offering.getCell("Service").data
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.getDescription(); });
		}
	
		this.services.forEach(function(d)
			{
				var name = d.getDescription();
				if (!names.find(function(d) { return d === name; }))
					names.push(name);
			});
	
		return names.join(", ");
	}

	Experience.prototype.appendView = function(header)
	{
		if (this.offeringName)
			header.append('div').classed('title', true).text(this.offeringName);
	
		orgDiv = header.append('div').classed("organization", true);		
		if (this.organizationName)
			orgDiv.append('div').text(this.organizationName);
			
		if (this.siteName)
			orgDiv.append('div')
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
				var section = header.append('section')
					.classed('cell view unique', true);
				section.append('ol')
					.append('li')
					.append('div').classed('string-value-view', true)
					.text(t);
			}
		}

		var s = this.getMarkerList();
		if (s.length > 0)
		{
			header.append('div')
				.classed('markers', true)
				.text(s);
		}
	}
	
	Experience.prototype.add = function()
	{
		bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

		var moreExperiencesObject = this.user.getValue("More Experiences");
		
		var _this = this;
		
		function onCreatedInstance(newData)
		{
			$(_this).trigger("experienceAdded.cr", newData);
		}
		
		function successFunction2(newData)
		{
			if (newData != moreExperiencesObject)
			{
				var cell = _this.user.getCell("More Experiences");
				cell.addValue(newData);
				moreExperiencesObject = _this.user.getValue("More Experiences");
			}
			
			field = {ofKind: "More Experience", name: "More Experience"};
			var initialData = {};

			_this.appendData(initialData);
			
			cr.createInstance(field, moreExperiencesObject.getValueID(), initialData, onCreatedInstance, syncFailFunction);
		}
		
		if (moreExperiencesObject && moreExperiencesObject.getValueID())
		{
			successFunction2(moreExperiencesObject);
		}
		else
		{
			field = {ofKind: "More Experiences", name: "More Experiences"};
			cr.createInstance(field, this.user.getValueID(), [], successFunction2, syncFailFunction);
		}
	}
	
	function Experience(dataExperience)
	{
		this.services = [];
		
		if (dataExperience)
		{
			function getReportedObject(dataExperience, pickedName, createdName)
			{
				var pickedObject = dataExperience.getValue(pickedName);
				if (pickedObject && pickedObject.isEmpty())
					pickedObject = null;
				if (pickedObject)
					return new ReportedObject({name: pickedObject.getDescription(), pickedObject: pickedObject});
				else
				{
					var createdObject = dataExperience.getValue(createdName);
					if (createdObject && !createdObject.isEmpty())
						return new ReportedObject({name: createdObject.getDescription()});
					else
						return new ReportedObject();
				}
			}
			
			var r;
			r = getReportedObject(dataExperience, "Organization", "User Entered Organization");
			this.organization = r.pickedObject;
			this.organizationName = r.name;
			
			r = getReportedObject(dataExperience, "Site", "User Entered Site");
			this.site = r.pickedObject;
			this.siteName = r.name;
			
			r = getReportedObject(dataExperience, "Offering", "User Entered Offering");
			this.offering = r.pickedObject;
			this.offeringName = r.name;
			
			var servicesCell = dataExperience.getCell("Service");
			var _this = this;
			servicesCell.data.forEach(function(d)
				{
					if (!d.isEmpty())
						_this.services.push(new ReportedObject({name: d.getDescription(), pickedObject: d}));
				});
				
			servicesCell = dataExperience.getCell("User Entered Service");
			servicesCell.data.forEach(function(d)
				{
					if (!d.isEmpty())
						_this.services.push(new ReportedObject({name: d.getDescription(), pickedObject: null}));
				});
		}
	}
	
	return Experience;
})();

var MultiTypeSearchView = (function() {
	MultiTypeSearchView.prototype = new PanelSearchView();
	MultiTypeSearchView.prototype.experience = null;
	MultiTypeSearchView.prototype.typeName = "";
	MultiTypeSearchView.prototype.initialTypeName = "";
	
	MultiTypeSearchView.prototype.drawButton = function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text", true);
				if (d.typeName === "Offering")
				{
					leftText.append('div')
						.classed('title', true).text(d.getDescription());
	
					orgDiv = leftText.append('div').classed("organization", true);		
					orgDiv.append('div').text(d.getValue("Organization").getDescription());
					orgDiv.append('div')
						.classed('address-line', true)
						.text(d.getValue("Site").getDescription());
				}
				else if (d.typeName === "Site")
				{
					orgDiv = leftText.append('div').classed("organization", true);		
					orgDiv.append('div').text(d.getValue("Organization").getDescription());
					orgDiv.append('div')
						.classed('address-line', true)
						.text(d.getDescription());
				}
				else if (d.typeName === "Organization")
				{
					orgDiv = leftText.append('div').classed("organization", true);		
					orgDiv.append('div').text(d.getDescription());
				}
				else
				{
					leftText.text(d.getDescription());
				}
			}
	
	MultiTypeSearchView.prototype.startSearchTimeout = function(val)
	{
		this.typeName = this.initialTypeName;
		SearchView.prototype.startSearchTimeout.call(this, val);
	}
				
	MultiTypeSearchView.prototype.fields = function()
	{
		var fields = SearchView.prototype.fields.call(this);
		fields.push('type');
		return fields;
	}
	
	MultiTypeSearchView.prototype.search = function(val)
	{
		if (!this.initialTypeName || !this.initialTypeName.length)
			throw "unset initialTypeName";
			
		this.typeName = this.initialTypeName;
		SearchView.prototype.search.call(this, val);
	}
	
	function MultiTypeSearchView(sitePanel, experience, placeholder, appendDescriptions)
	{
		this.experience = experience;
		PanelSearchView.call(this, sitePanel, placeholder, appendDescriptions, GetDataChunker)
	}
	
	return MultiTypeSearchView;
	
})();

var NewExperienceBasePanel = (function() {
	NewExperienceBasePanel.prototype = new SitePanel();
	
	function NewExperienceBasePanel(previousPanelNode, experience, panelClass, showFunction)
	{
		if (previousPanelNode)
		{
			var header = "Add Experience";
			SitePanel.call(this, previousPanelNode, null, header, panelClass, showFunction);
		
			var _this = this;
			var hide = function() { 
				asyncHidePanelDown(_this.node()); 
			};
			$(experience).on("experienceAdded.cr", hide);
			$(this.node()).on("remove", function () { $(experience).off("experienceAdded.cr", hide); });
		}
		else
			SitePanel.call(this);
	}
	
	return NewExperienceBasePanel;
})();

/* A search view for picking a service from a service domain. */
var ServiceSearchView = (function() {
	ServiceSearchView.prototype = new MultiTypeSearchView();
	
	ServiceSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'service: ' + d.getDescription()))
		{
			var service = this.experience.addService({instance: d});
			var _this = this;
			var panel = new NewExperienceFromServicePanel(this.sitePanel.node(), this.experience,
				function()
				{
					_this.experience.removeService(service);
				});
			showPanelLeft(panel.node(), unblockClick);
		}
		d3.event.preventDefault();
	}
	
	ServiceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (button == this.customButton.node())
		{
			if (compareText.length === 0)
				return false;
			var data = this.listPanel.selectAll("li").data();
			return !data.find(function(d) { return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText; });
		}
		else
		{
			if (compareText.length === 0)
				return true;
			
			return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
		}
	}
	
	ServiceSearchView.prototype.searchPath = function(val)
	{
		var path = '#{0}::reference(Service)'.format(this.experience.serviceDomain.getValueID());
			
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
	
	ServiceSearchView.prototype.clearListPanel = function()
	{
		var buttons = this.listPanel.selectAll("li");
		buttons = buttons.filter(function(d, i) { return i > 0; });
			
		buttons.remove();
		this.customButton.style("display", "none");
	}
	
	ServiceSearchView.prototype.textChanged = function()
	{
		SearchView.prototype.textChanged.call(this);

		var val = this.inputText();
		
		this.customButton.selectAll('.description-text').text('"{0}"'.format(val));
	}
	
	ServiceSearchView.prototype.showObjects = function(foundObjects)
	{
		var buttons = SearchView.prototype.showObjects.call(this, foundObjects);
			
		if (this.experience.services.length > 0)
		{
			var _this = this;
			buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
				function(d) { return typeof(d) == "object" && d == _this.experience.services[0]; });
		}
		
		return buttons;
	}
	
	function ServiceSearchView(experience, sitePanel)
	{
		this.initialTypeName = "Service";
		MultiTypeSearchView.call(this, sitePanel, experience, "Service");
		
		var _this = this;
		this.customButton = appendViewButtons(this.appendButtonContainers(["Service"]), 
					function(buttons)
					{
						var leftText = buttons.append('div').classed("left-expanding-div description-text", true);
						leftText.text("");
					}
			)
			.on("click", function(d, i) {
				if (prepareClick('click', 'Set Custom Service'))
				{
					var service = experience.addService({text: _this.inputText()});
					var panel = new NewExperienceFromServicePanel(sitePanel.node(), experience,
						function()
						{
							experience.removeService(service);
						});
					showPanelLeft(panel.node(), unblockClick);
				}
			})
			.style("display", "none");
	}
	
	return ServiceSearchView;
})();

var NewExperienceServicePanel = (function () {
	NewExperienceServicePanel.prototype = new NewExperienceBasePanel();
	
	function NewExperienceServicePanel(previousPanelNode, experience, onBack)
	{
		NewExperienceBasePanel.call(this, previousPanelNode, experience, "edit new-experience-panel");
		
		var _this = this;
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'edit object panel: Cancel'))
				{
					if (onBack) onBack();
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Back");
		
		navContainer.appendTitle(this.headerText);
						
		var searchView = new ServiceSearchView(experience, this);
		$(this.node()).one("revealing.cr", function() { 
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return NewExperienceServicePanel;
})();

var FromServiceSearchView = (function() {
	FromServiceSearchView.prototype = new MultiTypeSearchView();
	
	FromServiceSearchView.prototype.appendDescriptions = function(buttons)
	{
		buttons.each(this.drawButton);
	}
			
	FromServiceSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === "Offering")
		{
			if (prepareClick('click', 'offering: ' + d.getDescription()))
			{
				this.experience.setOffering({instance: d});
				/* Set the organization, then the site, because setting the organization may
					also set the site.
				 */
				this.experience.setOrganization({instance: d.getValue("Organization")});
				this.experience.setSite({instance: d.getValue("Site")});
				var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearOffering();
						_this.experience.clearOrganization();
					});
				showPanelLeft(panel.node(), unblockClick);
			
				/* Do not clear the services in case we come back to this item. */
			}
		}
		else if (d.typeName === "Site")
		{
			if (prepareClick('click', 'site: ' + d.getDescription()))
			{
				/* Set the organization, then the site, because setting the organization may
					also set the site.
				 */
				this.experience.setOrganization({instance: d.getValue("Organization")});
				this.experience.setSite({instance: d});
				var panel = new NewExperienceFromSitePanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearOrganization();
					});
				showPanelLeft(panel.node(), unblockClick);
			
				/* Do not clear the services in case we come back to this item. */
			}
		}
		else if (d.typeName === "Organization")
		{
			if (prepareClick('click', 'organization: ' + d.getDescription()))
			{
				/* Set the organization, then the site, because setting the organization may
					also set the site.
				 */
				this.experience.setOrganization({instance: d});
				var panel = new NewExperienceFromOrganizationPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearOrganization();
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		else if (d.typeName === "Service")
		{
			if (prepareClick('click', 'service: ' + d.getDescription()))
			{
				/* Set the organization, then the site, because setting the organization may
					also set the site.
				 */
				var oldService = this.experience.services[0];
				this.experience.removeService(oldService);
				var newService = this.experience.addService({instance: d});
				this.experience.setOffering({text: oldService.getDescription() });
				var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.removeService(newService);
						_this.experience.addService(oldService);
						_this.experience.clearOffering();
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		d3.event.preventDefault();
	}
	
	FromServiceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (button == this.organizationButton.node())
		{
			if (compareText.length === 0)
				return false;
			var data = this.listPanel.selectAll("li").data();
			return !data.find(function(d) { return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText; });
		}
		else
		{
			if (compareText.length === 0)
				return true;
				
			if (d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			var s = d.getValue("Site");
			if (s && s.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			var org = d.getValue("Organization");
			if (org && org.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			return false;
		}
	}
	
	FromServiceSearchView.prototype.searchPath = function(val)
	{
		var path;
		
		if (this.experience.organizationName != null &&
			this.experience.organization == null)
		{
			return "";	/* Can't look up offerings for a custom organization name. */
		}
		else if (val.length == 0)
		{
			path = this.experience.organization 
							? "#{0}>Sites>Site>Offerings>Offering".format(this.experience.organization.getValueID())
							: "Offering";
			if (this.experience.services[0].pickedObject)
				return "{0}[Service={1}]".format(path, this.experience.services[0].pickedObject.getValueID());
			else if (this.experience.organization)
				return path;
			else
				return "Service";
		}
		else
		{
			if (this.typeName === "Offering")
			{
				path = 'Offering[_name{0}"{1}"]';
				if (this.experience.organization)
					path = "#{0}>Sites>Site>Offerings>".format(this.experience.organization.getValueID()) + path;
				if (this.experience.services[0].pickedObject)
					path += '[Service={0}]'.format(this.experience.services[0].pickedObject.getValueID());
			}
			else if (this.typeName === "Offering from Site")
			{
				if (!(this.experience.organization == null && this.experience.organizationName == null))
					throw "Invalid case: organization is specified";
				path = 'Site[_name{0}"{1}"]>Offerings>Offering';
				if (this.experience.services[0].pickedObject)
					path += '[Service={0}]'.format(this.experience.services[0].pickedObject.getValueID());
			}
			else if (this.typeName === "Offering from Organization")
			{
				if (!(this.experience.organization == null && this.experience.organizationName == null))
					throw "Invalid case: organization is specified";
				path = 'Organization[_name{0}"{1}"]>Sites>Site>Offerings>Offering';
				if (this.experience.services[0].pickedObject)
					path += '[Service={0}]'.format(this.experience.services[0].pickedObject.getValueID());
			}
			else if (this.typeName === "Site")
			{
				if (this.experience.organization)
				{
					path = "#{0}>Sites>".format(this.experience.organization.getValueID()) + 
						   'Site[_name{0}"{1}"]>Offerings>Offering';
					if (this.experience.services[0].pickedObject)
						path += '[Service={0}]'.format(this.experience.services[0].pickedObject.getValueID());
				}
				else if (!this.experience.organizationName)
					path = 'Site[_name{0}"{1}"]';
				else
					return "";
			}
			else if (this.typeName === "Organization")
			{
				if (this.experience.organization)
				{
					path = "#{0}".format(this.experience.organization.getValueID()) + 
						   '[_name{0}"{1}"]>Sites>Site>Offerings>Offering';
					if (this.experience.services[0].pickedObject)
						path += '[Service={0}]'.format(this.experience.services[0].pickedObject.getValueID());
				}
				else if (!this.experience.organizationName)
				{
					path = 'Organization[_name{0}"{1}"]';
				}
				else
					return "";
			}
			

			var symbol = val.length < 3 ? "^=" : "*=";
			
			return path.format(symbol, val);
		}
	}
	
	FromServiceSearchView.prototype.noResultString = function()
	{
		if (this.typeName === "Organization" || !this._foundCompareText || this._foundCompareText.length == 0)
			return "No Results";
		else
			return "";
	}
	
	FromServiceSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	FromServiceSearchView.prototype.clearListPanel = function()
	{
		var buttons = this.listPanel.selectAll("li");
		buttons = buttons.filter(function(d) { return d !== "Organization"; });
			
		buttons.remove();
		this.organizationButton.style("display", "none");
	}
	
	FromServiceSearchView.prototype.textChanged = function()
	{
		SearchView.prototype.textChanged.call(this);

		var val = this.inputText();
		
		this.organizationButton.selectAll('.description-text').text('At "{0}"'.format(val));
	}
	
	function FromServiceSearchView(sitePanel, experience)
	{
		var _this = this;
		this.initialTypeName = "Offering";
		this.typeName = this.initialTypeName;
		
		MultiTypeSearchView.call(this, sitePanel, experience, "Organization, Offering", function(buttons) { _this.appendDescriptions(buttons); });
				
		var sections = this.appendButtonContainers(["Organization"]);
		this.organizationButton = appendViewButtons(sections, 
					function(buttons)
					{
						var leftText = buttons.append('div').classed("left-expanding-div description-text", true);

						leftText.append('div')
							.text("");
					}
			)
			.on("click", function(d, i) {
				if (prepareClick('click', 'Set Custom Organization'))
				{
					experience.setOrganization({text: _this.inputText() });
					var panel = new NewExperienceFromOrganizationPanel(sitePanel.node(), experience,
					function()
					{
						experience.clearOrganization();
					});
					showPanelLeft(panel.node(), unblockClick);
				}
			})
			.style("display", "none");

		this.getDataChunker._onDoneSearch = function()
			{
				var searchText = _this._foundCompareText;
				if (searchText && searchText.length > 0)
				{
					if (_this.typeName === "Offering")
					{
						if (experience.organization == null && experience.organizationName == null &&
							experience.site == null && experience.siteName == null)
							_this.typeName = "Offering from Site";
						else
							_this.typeName = "Site";
					}
					else if (_this.typeName === "Offering from Site")
						_this.typeName = "Offering from Organization";
					else if (_this.typeName === "Offering from Organization")
						_this.typeName = "Site";
					else if (_this.typeName === "Site")
					{
						_this.typeName = "Organization";
					}
					else
						return;
					
					this.path = _this.searchPath(searchText);
					this.fields = _this.fields();
					this.checkStart(searchText);
				}			
			};
	}
	
	return FromServiceSearchView;
})();

/* This is an intermediate panel for the workflow. The experience contains a marker and nothing else. 
	From here, the user can specify an organization, a known site, a known offering.
 */
var NewExperienceFromServicePanel = (function () {
	NewExperienceFromServicePanel.prototype = new NewExperienceBasePanel();
	
	function NewExperienceFromServicePanel(previousPanelNode, experience, onBack)
	{
		NewExperienceBasePanel.call(this, previousPanelNode, experience, "edit experience new-experience-panel");
			
		var _this = this;
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'NewExperienceFromServicePanel: Cancel'))
				{
					if (onBack) onBack();
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Back");
		
		navContainer.appendTitle(this.headerText);
						
		var experienceView = this.panelDiv.append('header');
		var searchView = new FromServiceSearchView(this, experience);
		searchView.experienceView = experienceView;
		
		experience.appendView(experienceView);
		$(this.node()).one("revealing.cr", function() 
			{ 
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return NewExperienceFromServicePanel;
})();

/* This is a parent class for the FromOrganizationSearchView and the FromSiteSearchView */
var FromOfferingParentSearchView = (function() {
	FromOfferingParentSearchView.prototype = new MultiTypeSearchView();
	FromOfferingParentSearchView.prototype.customButton = null;
	
	FromOfferingParentSearchView.prototype.showFinishPanel = function(r)
	{
		var _this = this;
		if (this.experience.services.length == 0)
		{
			var service = this.experience.addService(r);
			var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
			function()
			{
				_this.experience.removeService(service);
			});
			showPanelLeft(panel.node(), unblockClick);
		}
		else if (this.experience.services[0].pickedObject)
		{
			this.experience.setOffering(r);
			var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
				function()
				{
					_this.experience.clearOffering();
				});
			showPanelLeft(panel.node(), unblockClick);
		}
		else
		{
			var oldService = this.experience.services[0];
			this.experience.removeService(oldService);
			var newService = this.experience.addService(r);
			this.experience.setOffering({text: oldService.getDescription() });
			var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
				function()
				{
					_this.experience.removeService(newService);
					_this.experience.addService(oldService);
					_this.experience.clearOffering();
				});
			showPanelLeft(panel.node(), unblockClick);
		}
	}
	
	FromOfferingParentSearchView.prototype.clearListPanel = function()
	{
		var buttons = this.listPanel.selectAll("li");
		buttons = buttons.filter(function(d, i) { return i > 0; });
			
		buttons.remove();
		this.customButton.style("display", "none");
	}
	
	FromOfferingParentSearchView.prototype.textChanged = function()
	{
		SearchView.prototype.textChanged.call(this);

		var val = this.inputText();
		
		this.customButton.selectAll('.description-text').text('"{0}"'.format(val));
	}
	
	FromOfferingParentSearchView.prototype.cancelSearch = function()
	{
		SearchView.prototype.cancelSearch.call(this);
		this.customButton.style("display", this.inputText().length > 0 ? null : "none");
	}
	
	function FromOfferingParentSearchView(sitePanel, experience, placeholder, appendDescriptions)
	{
		MultiTypeSearchView.call(this, sitePanel, experience, placeholder, appendDescriptions)
		
		if (sitePanel)
		{
			var _this = this;
			var sections = this.appendButtonContainers(["Custom"]);
			this.customButton = appendViewButtons(sections, 
						function(buttons)
						{
							buttons.append('div').classed("left-expanding-div description-text", true);
						}
				)
				.on("click", function(d, i) {
					if (prepareClick('click', 'Set Custom Marker'))
					{
						_this.showFinishPanel({text: _this.inputText() });
					}
				})
				.style('display', 'none');

		}
	}
	
	return FromOfferingParentSearchView;
})();

var FromOrganizationSearchView = (function() {
	FromOrganizationSearchView.prototype = new FromOfferingParentSearchView();
	
	FromOrganizationSearchView.prototype.appendDescriptions = function(buttons)
	{
		buttons.each(this.drawButton);
	}
			
	FromOrganizationSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === "Offering")
		{
			if (prepareClick('click', 'offering: ' + d.getDescription()))
			{
				this.experience.setOffering({instance: d});
				/* Set the organization, then the site, because setting the organization may
					also set the site.
				 */
				this.experience.setSite({instance: d.getValue("Site")});
				var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearOffering();
						_this.experience.clearSite();
					});
				showPanelLeft(panel.node(), unblockClick);
			
				/* Do not clear the services in case we come back to this item. */
			}
		}
		else if (d.typeName === "Site")
		{
			if (prepareClick('click', 'site: ' + d.getDescription()))
			{
				this.experience.setSite({instance: d});
				var panel = new NewExperienceFromSitePanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearSite();
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		else if (d.typeName === "Service")
		{
			if (prepareClick('click', 'service: ' + d.getDescription()))
			{
				var service = this.experience.addService({instance: d});
				var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.removeService(service);
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		d3.event.preventDefault();
	}
	
	FromOrganizationSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (button == this.customButton.node())
		{
			if (compareText.length === 0)
				return false;
			var data = this.listPanel.selectAll("li").data();
			return !data.find(function(d) { return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText; });
		}
		else
		{
			if (compareText.length === 0)
				return true;
			
			if (d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			if (d.typeName === "Offering")
			{
				if (d.getValue("Site").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
					return true;
				if (d.getValue("Organization").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
					return true;
			}
			else if (d.typeName === "Site")
			{
				if (d.getValue("Organization").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
					return true;
			}
			return false;
		}
	}
	
	FromOrganizationSearchView.prototype.searchPath = function(val)
	{
		var path;
		
		if (this.experience.organization == null)
		{
			if (this.experience.services.length == 0)
				return "Service";	/* Can't look up offerings for a custom organization name. */
			else
				return "";
		}
		else if (val.length == 0)
		{
			if (this.typeName === "Site")
				return "#{0}>Sites>Site".format(this.experience.organization.getValueID())
			else if (this.typeName === "Offering")
			{
				path = "#{0}>Sites>Site>Offerings>Offering".format(this.experience.organization.getValueID());
				if (this.experiences.services.length > 0 && this.experiences.services[0].pickedObject)
				{
					path += '[Service={0}]'.format(this.experience.services[0].pickedObject.getValueID());
				}
				return path;
			}
			else if (this.typeName === "Service")
				return "#{0}>Sites>Site>Offerings>Offering>Service".format(this.experience.organization.getValueID())
			else
				return "Service";
		}
		else
		{
			if (this.typeName === "Offering")
			{
				path = 'Offering[_name{0}"{1}"]';
				if (this.experience.organization)
					path = "#{0}>Sites>Site>Offerings>".format(this.experience.organization.getValueID()) + path;
			}
			else if (this.typeName === "Site")
			{
				path = 'Site[_name{0}"{1}"]>Offerings>Offering';
				if (this.experience.organization)
					path = "#{0}>Sites>".format(this.experience.organization.getValueID()) + path;
			}
			else if (this.typeName === "Service")
			{
				path = 'Service[_name{0}"{1}"]';
			}
			
			var symbol = val.length < 3 ? "^=" : "*=";
			
			return path.format(symbol, val);
		}
	}
	
	FromOrganizationSearchView.prototype.noResultString = function()
	{
		return "";
	}
	
	FromOrganizationSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	function FromOrganizationSearchView(sitePanel, experience)
	{
		if (!experience.organizationName)
			throw "experience organization name is not specified";
			
		var _this = this;
		this.initialTypeName = "Site";
		this.typeName = this.initialTypeName;
		
		var placeHolder = experience.organization ? "Site, Offering" : "Offering";
		if (experience.services.length == 0)
			placeHolder += ", Marker";
		
		FromOfferingParentSearchView.call(this, sitePanel, experience, placeHolder, function(buttons) { _this.appendDescriptions(buttons); });
				
		this.getDataChunker._onDoneSearch = function()
			{
				var searchText = _this._foundCompareText;
				if (experience.organization && searchText && searchText.length > 0)
				{
					if (_this.typeName === "Site")
					{
						_this.typeName = "Offering";
					}
					else if (_this.typeName === "Offering" && experience.services.length == 0)
					{
						_this.typeName = "Service";
					}
					else
						return;
					
					this.path = _this.searchPath(searchText);
					this.fields = _this.fields();
					this.checkStart(searchText);
				}
				else if (experience.organization && experience.services.length > 0)
				{
					if (_this.typeName === "Site")
					{
						_this.typeName = "Offering";
					}
					else
						return;
					
					this.path = _this.searchPath(searchText);
					this.fields = _this.fields();
					this.checkStart(searchText);
				}			
			};
	}
	
	return FromOrganizationSearchView;
})();

/* This is an intermediate panel for the workflow. The experience contains an organization or an organizationName.
	The experience may or may not also have a marker. 
	From here, the user can specify, if the organization is known, a site or offering within that organization. 
	If the experience has no marker, the user can specify a known marker or a custom marker.
 */
var NewExperienceFromOrganizationPanel = (function () {
	NewExperienceFromOrganizationPanel.prototype = new NewExperienceBasePanel();
	
	function NewExperienceFromOrganizationPanel(previousPanelNode, experience, onBack)
	{
		NewExperienceBasePanel.call(this, previousPanelNode, experience, "edit experience new-experience-panel");
			
		var _this = this;
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'edit object panel: Cancel'))
				{
					if (onBack) onBack();
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Back");
		
		navContainer.appendTitle(this.headerText);
						
		var experienceView = this.panelDiv.append('header');
		var searchView = new FromOrganizationSearchView(this, experience);
		searchView.experienceView = experienceView;
		
		experience.appendView(experienceView);
		$(this.node()).one("revealing.cr", function() 
			{ 
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return NewExperienceFromOrganizationPanel;
})();

var FromSiteSearchView = (function() {
	FromSiteSearchView.prototype = new FromOfferingParentSearchView();
	
	FromSiteSearchView.prototype.appendDescriptions = function(buttons)
	{
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text", true);
				leftText.text(d.getDescription());
			});
	}
			
	FromSiteSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === "Offering")
		{
			if (prepareClick('click', 'offering: ' + d.getDescription()))
			{
				this.experience.setOffering({instance: d});
				var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearOffering();
					});
				showPanelLeft(panel.node(), unblockClick);
			
				/* Do not clear the services in case we come back to this item. */
			}
		}
		else if (d.typeName === "Service")
		{
			if (prepareClick('click', 'service: ' + d.getDescription()))
			{
				var service = this.experience.addService({instance: d});
				var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.removeService(service);
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		d3.event.preventDefault();
	}
	
	FromSiteSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (button == this.customButton.node())
		{
			if (compareText.length === 0)
				return false;
			var data = this.listPanel.selectAll("li").data();
			return !data.find(function(d) { return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText; });
		}
		else
		{
			if (compareText.length === 0)
				return true;
			
			if (d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
				return true;
			if (d.typeName === "Offering")
			{
				if (d.getValue("Site").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
					return true;
				if (d.getValue("Organization").getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
					return true;
			}
			return false;
		}
	}
	
	FromSiteSearchView.prototype.searchPath = function(val)
	{
		var path;
		
		if (this.experience.siteName != null &&
			this.experience.site == null)
		{
			return "Service";	/* Can't look up offerings for a custom site name. */
		}
		else if (val.length == 0)
		{
			if (!this.experience.site)
				return "Service";
			else if (this.typeName === "Offering")
				return "#{0}>Offerings>Offering".format(this.experience.site.getValueID())
			else if (this.typeName === "Service")
				return "#{0}>Offerings>Offering>Service".format(this.experience.site.getValueID())
			else
				return "Service";
		}
		else
		{
			if (this.typeName === "Offering")
			{
				path = 'Offering[_name{0}"{1}"]';
				if (this.experience.organization)
					path = "#{0}>Offerings>".format(this.experience.site.getValueID()) + path;
			}
			else if (this.typeName === "Service")
			{
				path = 'Service[_name{0}"{1}"]';
			}
			
			var symbol = val.length < 3 ? "^=" : "*=";
			
			return path.format(symbol, val);
		}
	}
	
	FromSiteSearchView.prototype.noResultString = function()
	{
		return "";
	}
	
	FromSiteSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	function FromSiteSearchView(sitePanel, experience)
	{
		if (!experience.siteName)
			throw "experience site name is not specified";
			
		var _this = this;
		this.initialTypeName = "Offering";
		this.typeName = this.initialTypeName;
		
		var placeHolder = "Offering";
		if (experience.services.length == 0)
			placeHolder += ", Marker";
		
		FromOfferingParentSearchView.call(this, sitePanel, experience, placeHolder, function(buttons) { _this.appendDescriptions(buttons); });
				
		this.getDataChunker._onDoneSearch = function()
			{
				var searchText = _this._foundCompareText;
				if (experience.site && searchText && searchText.length > 0)
				{
					if (_this.typeName === "Offering" && experience.services.length === 0)
					{
						_this.typeName = "Service";
					}
					else
						return;
					
					this.path = _this.searchPath(searchText);
					this.fields = _this.fields();
					this.checkStart(searchText);
				}			
			};
	}
	
	return FromSiteSearchView;
})();

/* This is an intermediate panel for the workflow. the experience contains a site or a siteName, but no offering or marker. 
	From here, the user can specify a known marker, custom marker or, if the site is known, 
	an offering within that site.
 */
var NewExperienceFromSitePanel = (function () {
	NewExperienceFromSitePanel.prototype = new NewExperienceBasePanel();
	
	function NewExperienceFromSitePanel(previousPanelNode, experience, onBack)
	{
		NewExperienceBasePanel.call(this, previousPanelNode, experience, "edit experience new-experience-panel");
			
		var _this = this;
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'edit object panel: Cancel'))
				{
					if (onBack) onBack();
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Back");
		
		navContainer.appendTitle(this.headerText);
						
		var experienceView = this.panelDiv.append('header');
		var searchView = new FromSiteSearchView(this, experience);
		searchView.experienceView = experienceView;
		
		experience.appendView(experienceView);
		$(this.node()).one("revealing.cr", function() 
			{ 
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return NewExperienceFromSitePanel;
})();

/* A reported object combines a name and an object value that might be picked. */
var ReportedObject = function () {
	ReportedObject.prototype.name = null;
	ReportedObject.prototype.pickedObject = null;
	
	function ReportedObject(args) {
		args = args !== undefined ? args : {};
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

/* This panel is called from the NewExperiencesMarkersPanel to pick a new marker or change to a marker.
 */
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

	function PickServicePanel(previousPanelNode, rootObjects, oldReportedObject, experience, success)
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
					_this.hidePanelRight(unblockClick);
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
		
		navContainer.appendTitle(header);
	
		var textChanged = function(){
			var val = this.value.toLocaleLowerCase();
			if (val.length == 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", function(d, i)
						{
							return i > 0 ? null : 'none';
						});
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d, i)
						{
							if (i == 0)
							{
								if (_this.getObjectByDescription(rootObjects, searchInputNode.value))
									return 'none';
								else
									return null;
							}
							else
								return d.getDescription().toLocaleLowerCase().indexOf(val) >= 0 ? null : 'none';
						});
				customButton.selectAll('.description-text').text('"{0}"'.format(this.value));
			}
		}

		var searchInputNode = _this.appendSearchBar(textChanged);

		var panel2Div = _this.appendScrollArea();
	
		function buttonClicked(d) {
			if (prepareClick('click', 'pick service: ' + d.getDescription()))
			{
				success(new ReportedObject({pickedObject: d}));
				_this.hidePanelRight(unblockClick);
			}
			d3.event.preventDefault();
		}
		
		var itemsDiv = panel2Div.append("section")
			.classed("multiple", true)
			.append("ol");

		var customButton = itemsDiv.append('li')
			.style('display', 'none')
			.on ('click', function() {
					if (prepareClick('click', 'add custom service'))
					{
						var newValue = _this.getObjectByDescription(rootObjects, searchInputNode.value);
						success(new ReportedObject({name: searchInputNode.value, pickedObject: newValue}));
						_this.hidePanelRight(unblockClick);
					}
					d3.event.preventDefault();
				});
		appendViewButtons(customButton, function(buttons) {
				buttons.append("div")
					.classed("description-text", true)
					.text("");
			});
	
		var i = 0;
		var sections = itemsDiv.selectAll("li")
					.data(rootObjects, function(d) {
						/* Ensure that this operation appends without replacing any items. */
						i += 1;
						return i;
					  })
					.enter()
					.append("li");

		var buttons = appendViewButtons(sections, appendDescriptions)
			.on("click", buttonClicked);

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

/* This is the panel that appears from the final panel to add markers, if desired */
var NewExperienceMarkersPanel = (function () {
	NewExperienceMarkersPanel.prototype = new SitePanel();
	NewExperienceMarkersPanel.prototype.experience = null;
	
	function NewExperienceMarkersPanel(previousPanelNode, experience, done)
	{
		SitePanel.call(this, previousPanelNode, null, "Markers", "edit new-experience-markers");

		var _this = this;
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
				{
					if (prepareClick('click', 'Close Right'))
					{
						done();
						_this.hidePanelRight(unblockClick);
					}
				});
				
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("span").text(" " + previousPanelNode.getAttribute("headerText"));
		
		navContainer.appendTitle("Markers");
		
		var panel2Div = this.appendScrollArea();

		var header = panel2Div.append('section')
			.append('p');
		
		if (experience.offering && experience.offering.getCell("Service").data.length > 0)
			header.text("Markers indicate the type or the benefit of this experience.");
		else
			header.text("Some experiences need more than one marker, such as being the captain of a soccer team or getting a summer job working with computers.");

		var obj = panel2Div.append('section')
			.classed("cell edit multiple", true);
		
		var labelDiv = obj.append('label')
			.text("Markers");
		
		var itemsDiv = obj.append("ol")
			.classed("border-above", true);

		var clickFunction;
		clickFunction = function(d) {
				var _thisButton = this;
				if (prepareClick('click', 'marker: ' + d.getDescription()))
				{
					crp.getData({path: "Service", 
					done: function(rootObjects)
					{
						var success = function(newReportedObject)
						{
							var divs = d3.select($(_thisButton).parents("li")[0]);
							/* Set the datum for the li and this object so that the correct object is used in future clicks. */
							divs.datum(newReportedObject);
							d3.select(_thisButton).datum(newReportedObject);
							var s = divs.selectAll(".description-text").text(newReportedObject.getDescription());
							experience.services[experience.services.indexOf(d)] = newReportedObject;
						}
						new PickServicePanel(_this.node(), rootObjects, d, experience, success);
					}, 
					fail: syncFailFunction});
				}
			};
	
		function appendOfferingServices()
		{
			if (experience.offering != null)
			{
				var fixedDivs = appendItems(itemsDiv, experience.offering.getCell("Service").data);
				var itemDivs = fixedDivs.append("div")
					.classed("multi-row-content", true)
				appendButtonDescriptions(itemDivs);
			}
		}
	
		function _confirmDeleteClick(d)
		{
			var a = experience.services;
			a.splice($.inArray(d, a), 1);
			var item = $(this).parents("li")[0];
			$(item).animate({height: "0px"}, 200, 'swing', function() { $(item).remove(); });
		}

		function appendServices(services)
		{
			var divs;
			if (experience.offering && 
				services.length > 0 && 
				services[0].pickedObject && 
				experience.offering.getCell("Service").data.find(function(d)
					{
						return d.getValueID() == services[0].pickedObject.getValueID()
					}))
			{
				divs = appendItems(itemsDiv, services.filter(function(d, i) { return i > 0; }));
			}
			else
			{
				divs = appendItems(itemsDiv, services);
			}
			
			appendConfirmDeleteControls(divs)
				.on('click', _confirmDeleteClick);
		
			var buttons = appendRowButtons(divs);
			buttons.on("click", clickFunction);
			appendDeleteControls(buttons);
			appendRightChevrons(buttons);
			appendButtonDescriptions(buttons);
		}
	
		appendOfferingServices();
		appendServices(experience.services);
	
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
							experience.services.push(newReportedObject);
							appendServices([newReportedObject]);
						}
						new PickServicePanel(_this.node(), rootObjects, null, experience, success);
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
			appendServices(experience.services);
		}
	
	}
	
	return NewExperienceMarkersPanel;
})();

/* This is the exit panel for the workflow. The experience contains either an organization or organizationName
	as well as at least one service. It may also contain a site and/or an offering.
	
	This panel can modify the markers and set the start and end dates. */
var NewExperienceFinishPanel = (function () {
	NewExperienceFinishPanel.prototype = new NewExperienceBasePanel();
	NewExperienceFinishPanel.prototype.experience = null;
	
	function NewExperienceFinishPanel(previousPanelNode, experience, onBack, showFunction)
	{
		NewExperienceBasePanel.call(this, previousPanelNode, experience, "edit experience new-experience-date-panel", showFunction);
		
		var _this = this;
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'NewExperienceFinishPanel: Back'))
				{
					if (onBack) onBack();
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Back");
		
		var nextButton = navContainer.appendRightButton()
			.classed("site-active-text", false)
			.classed("site-disabled-text", true)
			.classed("default-link", true)
			.on("click", function()
			{
				if (startDateInput.year && startDateInput.month)
				{
					if (prepareClick('click', 'NewExperienceFinishPanel: Add'))
					{
						experience.startDate = startDateInput.value();
						experience.endDate = endDateInput.value();
						
						experience.add();
					}
				}
				d3.event.preventDefault();
			});
		nextButton.append("span").text("Add");
		
		navContainer.appendTitle("Add Experience");
		
		var panel2Div = this.appendScrollArea();

		var experienceView = panel2Div.append('header');
		experience.appendView(experienceView);
		
		var birthday = experience.user.getDatum("Birthday");
		
		var startDateContainer = panel2Div.append('section')
			.classed('cell edit unique date-container', true);

		startDateContainer.append('label')
			.text("Start");
		var itemsDiv = startDateContainer.append('ol');
		var itemDiv = itemsDiv.append('li');
		var startDateInput = new DateInput(itemDiv.node(), new Date(birthday));
		
		$(startDateInput).on('change', function(eventObject) {
			var isEnabled = this.year && this.month;
			nextButton
				.classed("site-disabled-text", !isEnabled)
				.classed("site-active-text", isEnabled);
				
			var minEndDate;
			if (this.value() && this.value().length > 0)
				minEndDate = new Date(this.value());
			else if (birthday)
				minEndDate = new Date(birthday);
			else
				minEndDate = undefined;
				
			endDateInput.checkMinDate(minEndDate);
		});
		
		var endDateContainer = panel2Div.append('section')
			.classed('cell edit unique date-container', true);
		var endLabel = endDateContainer.append('label')
			.text("End");
		var endLabelWidth;
		
		var itemsDiv = endDateContainer.append('ol');
		var itemDiv = itemsDiv.append('li');
		var endDateInput = new DateInput(itemDiv.node(), new Date(birthday));
		var $dateRow = $(endDateContainer.selectAll(".date-row").node());
		var dateWidth;

		var endDateChevron = appendRightChevrons(itemDiv);
		var $chevron = $(endDateChevron.node());
		var chevronWidth;
		$chevron.width(0);
		$chevron.css('display', 'none');
		
		var notFinishedSpan = endDateContainer.append('span')
			.classed('in-cell-button site-active-text', true)
			.on('click', function()
				{
					if (prepareClick('click', "It isn't finished."))
					{
						$dateRow.animate({left: dateWidth, width: 0}, 400, function()
							{
								endDateInput.clear();
								$dateRow.css('display', 'none');
								$chevron.css('display', '');
								$chevron.animate({left: 0, width: chevronWidth}, 200, function()
									{
										notFinishedSpan.classed('site-active-text', false)
											.classed('site-disabled-text', true);
										unblockClick();
									});
							}
						);
					}
				})
			.text("It isn't finished.");
			
		endDateChevron.on('click', function()
			{
				if (prepareClick('click', 'end date chevron'))
				{
					$chevron.animate({left: chevronWidth, width: 0}, 200, function()
						{
							$chevron.css('display', 'none');
							$dateRow.css('display', '');
							$dateRow.animate({left: 0, width: dateWidth}, 400, function()
								{
									notFinishedSpan.classed('site-active-text', true)
										.classed('site-disabled-text', false);
									unblockClick();
								});
						});
				}
			});
			
		$(this.node()).one("revealing.cr", function()
			{
				dateWidth = $dateRow.width();
				
				$chevron.css("width", "");
				chevronWidth = $chevron.width();
				$chevron.width(0);
				$chevron.height($dateRow.height());	/* Force them to the same height. */
			});
		
		this.appendActionButton("Markers", function()
			{
				if (prepareClick('click', 'new NewExperienceMarkersPanel'))
				{
					var panel = new NewExperienceMarkersPanel(_this.node(), experience,
						function()
						{
							experienceView.selectAll('*').remove();
							experience.appendView(experienceView);
						});
					showPanelLeft(panel.node(), unblockClick);
				}
			});	
	}
	
	return NewExperienceFinishPanel;
})();

var NewExperienceSearchView = (function() {
	NewExperienceSearchView.prototype = new MultiTypeSearchView();
	NewExperienceSearchView.prototype.typeName = null;
	
	NewExperienceSearchView.prototype.appendDescriptions = function(buttons)
	{
		buttons.each(this.drawButton);
	}
			
	NewExperienceSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === 'Service Domain')
		{
			if (prepareClick('click', 'service domain: ' + d.getDescription()))
			{
				this.experience.serviceDomain = d;
				var panel = new NewExperienceServicePanel(this.sitePanel.node(), this.experience,
					function() { _this.experience.servicePanel = null; });
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		else if (d.typeName === 'Service')
		{
			if (prepareClick('click', 'service: ' + d.getDescription()))
			{
				var service = this.experience.addService({instance: d});
				var panel = new NewExperienceFromServicePanel(this.sitePanel.node(), this.experience,
					function() {
						_this.experience.removeService(service);
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		else if (d.typeName === 'Organization')
		{
			if (prepareClick('click', 'organization: ' + d.getDescription()))
			{
				this.experience.setOrganization({instance: d});
				var panel = new NewExperienceFromOrganizationPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearOrganization();
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		else if (d.typeName === 'Site')
		{
			if (prepareClick('click', 'site: ' + d.getDescription()))
			{
				this.experience.setOrganization({instance: d});
				var panel = new NewExperienceFromSitePanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearSite();
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		else if (d.typeName === 'Offering')
		{
			if (prepareClick('click', 'offering: ' + d.getDescription()))
			{
				this.experience.setOffering({instance: d});
				/* Set the organization, then the site, because setting the organization may
					also set the site.
				 */
				this.experience.setOrganization({instance: d.getValue("Organization")});
				this.experience.setSite({instance: d.getValue("Site")});
				var panel = new NewExperienceFinishPanel(this.sitePanel.node(), this.experience,
					function()
					{
						_this.experience.clearOffering();
						_this.experience.clearOrganization();
					});
				showPanelLeft(panel.node(), unblockClick);
			}
		}
		d3.event.preventDefault();
	}
	
	NewExperienceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (typeof(d) != "object")
		{
			if (compareText.length === 0)
				return false;
			var data = this.listPanel.selectAll("li").data();
			return !data.find(function(d) { return d.getDescription && d.getDescription().toLocaleLowerCase() === compareText; });
		}
		else
		{
			if (compareText.length === 0)
				return true;
			
			return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
		}
	}
	
	NewExperienceSearchView.prototype.noResultString = function()
	{
		return "";
	}
	
	NewExperienceSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	NewExperienceSearchView.prototype.clearListPanel = function()
	{
		var buttons = this.listPanel.selectAll("li");
		buttons = buttons.filter(function(d, i) { return i > 1; });
			
		buttons.remove();
		this.organizationButton.style("display", "none");
		this.customServiceButton.style("display", "none");
	}
	
	NewExperienceSearchView.prototype.canConstrain = function(searchText, constrainText)
	{
		/* Force searching if the searchText length is 0. */
		if (searchText.length === 0)
			return false;
			
		return SearchView.prototype.canConstrain.call(this, searchText, constrainText);
	}
	
	NewExperienceSearchView.prototype.searchPath = function(val)
	{
		return '::NewExperience:'+val;
// 		var path = this.typeName;
// 			
// 		if (val.length == 0)
// 			return path;
// 		else if (val.length < 3)
// 			return '{1}[_name^="{0}"]'.format(val, path);
// 		else
// 			return '{1}[_name*="{0}"]'.format(val, path);
	}
	
	NewExperienceSearchView.prototype.textChanged = function()
	{
		SearchView.prototype.textChanged.call(this);

		var val = this.inputText();
		
		this.organizationButton.selectAll('.description-text').text('At "{0}"'.format(val));
		this.customServiceButton.selectAll('.description-text').text('"{0}"'.format(val));
	}
	
	function NewExperienceSearchView(sitePanel, experience)
	{
		this.initialTypeName = '"Service Domain"';
		this.typeName = this.initialTypeName;
		MultiTypeSearchView.call(this, sitePanel, experience, "Place, Program, Marker", function(buttons) { _this.appendDescriptions(buttons); })
		
		var sections = this.appendButtonContainers(["Organization"]);
		this.organizationButton = appendViewButtons(sections, 
					function(buttons)
					{
						var leftText = buttons.append('div').classed("left-expanding-div description-text", true);
					}
			)
			.on("click", function(d, i) {
				if (prepareClick('click', 'Set Custom Organization'))
				{
					experience.setOrganization({text: _this.inputText()});
					var panel = new NewExperienceFromOrganizationPanel(sitePanel.node(), experience,
						function()
						{
							experience.clearOrganization();
						});
					showPanelLeft(panel.node(), unblockClick);
				}
			})
			.style("display", "none");

		sections = this.appendButtonContainers(["Offering"]);
		this.customServiceButton = appendViewButtons(sections,  
					function(buttons)
					{
						var leftText = buttons.append('div').classed("left-expanding-div description-text", true);
					}
			)
			.on("click", function(d, i) {
				if (prepareClick('click', 'Set Custom Service'))
				{
					var service = experience.addService({text: _this.inputText()});
					var panel = new NewExperienceFromServicePanel(sitePanel.node(), experience,
						function()
						{
							experience.removeService(service);
						});
					showPanelLeft(panel.node(), unblockClick);
				}
			})
			.style("display", "none");

		var _this = this;
// 		this.getDataChunker._onDoneSearch = function()
// 			{
// 				var searchText = _this._foundCompareText;
// 				if (searchText && searchText.length > 0)
// 				{
// 					if (_this.typeName === '"Service Domain"')
// 					{
// 						_this.typeName = "Service";
// 					}
// 					else if (_this.typeName === "Service")
// 					{
// 						_this.typeName = "Offering";
// 					}
// 					else if (_this.typeName === "Offering")
// 					{
// 						_this.typeName = "Site";
// 					}
// 					else if (_this.typeName === "Site")
// 					{
// 						_this.typeName = "Organization";
// 					}
// 					else
// 						return;
// 			
// 					this.path = _this.searchPath(searchText);
// 					this.fields = _this.fields();
// 					this.checkStart(searchText);
// 				}			
// 			};
	}
	
	return NewExperienceSearchView;
})();

/* This is the entry panel for the workflow. The experience contains no data on entry. 
	This panel can specify a search domain or, with typing, pick a service, offering, organization or site.
	One can also specify a custom service or a custom organization. */
var NewExperiencePanel = (function () {
	NewExperiencePanel.prototype = new NewExperienceBasePanel();
	
	function NewExperiencePanel(experience, previousPanelNode) {

		NewExperienceBasePanel.call(this, previousPanelNode, experience, "edit new-experience-panel", revealPanelUp);
		var _this = this;
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'NewExperiencePanel: Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
		
		navContainer.appendTitle(this.headerText);
						
		var searchView = new NewExperienceSearchView(this, experience);
		
		$(this.node()).one("revealing.cr", function() 
			{ 
				searchView.search(""); 
				searchView.inputBox.focus();
			});

		showPanelUp(this.node(), unblockClick);
	}
	
	return NewExperiencePanel;
})();

