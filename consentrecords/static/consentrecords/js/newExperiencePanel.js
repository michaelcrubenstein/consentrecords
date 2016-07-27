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
	
	/* The path containing the object to which to add the experience. */
	Experience.prototype.path = null;
	
	Experience.prototype.setOrganization = function(args) {
		if ("instance" in args && args.instance)
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
		else if ("text" in args && args.text)
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
		if ("instance" in args && args.instance)
		{
			var d = args.instance;
			this.site = d;
			this.siteName = d.getDescription();
		}
		else if ("text" in args && args.text)
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
		if ("instance" in args && args.instance)
		{
			var d = args.instance;
			this.offering = d;
			this.offeringName = d.getDescription();
		}
		else if ("text" in args && args.text)
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
	
	/* Args can either be a ReportedObject or a dictionary with a "text" or "instance" property. */
	Experience.prototype.addService = function(args)
	{
		var service;
		
		if (args.constructor === ReportedObject)
		{
			service = args;
			this.services.push(service);
		}
		else if ("text" in args && args.text)
		{
			var newName = args.text;
			var d = args.instance;
			service = new ReportedObject({name: newName, pickedObject: d});
			if (newName.length > 0)
			{
				this.services.push(service);
			}
		}
		else if ("instance" in args && args.instance)
		{
			var d = args.instance;
			var service = new ReportedObject({pickedObject: d})
			this.services.push(service);
		}
		else
			throw "Invalid arguments to addService";
			
		return service;
	}
	
	Experience.prototype.removeService = function(service)
	{
		var index = this.services.indexOf(service);
		if (index >= 0)
			this.services.splice(index, 1);
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
		
		var existingServices = null;
		if (this.offering && this.offering.getCell("Service"))
			existingServices = this.offering.getCell("Service").data;
				
		for (i = (this.offering || this.offeringName ||
				  (this.services.length > 0 && this.services[0].pickedObject)) ? 0 : 1; 
			i < this.services.length; ++i)
		{
			var s = this.services[i];
			
			/* Make sure the service isn't part of the offering's services. */
			if (s.pickedObject)
			{
				if (!existingServices || 
					!existingServices.find(function(d) { 
						return s.pickedObject.getValueID() == d.getValueID(); 
					}))
				{
					if (!initialData["Service"])
						initialData["Service"] = [{instanceID: s.pickedObject.getValueID()}];
					else
						initialData["Service"].push({instanceID: s.pickedObject.getValueID()});
				}
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
	
	Experience.prototype.getTagList = function()
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
	
	Experience.prototype.setHeightByText = function(node, textDiv, text, step)
	{
		var jNode = $(node);
		if (text)
		{
			textDiv.text(text);
			var oldHeight = jNode.height();
			jNode.height('auto');
			var height = jNode.height();
			jNode.height(oldHeight);
			jNode.animate({height: height}, {duration: 400, easing: 'swing', step: step});
		}
		else
			jNode.animate({height: 0}, {duration: 400, easing: 'swing', step: step, done: function() { textDiv.text(text); }});
	}

	Experience.prototype.appendView = function(header, step)
	{
		function checkChild(container, className)
		{
			var div = container.selectAll('div.{0}'.format(className));
			if (div.size() == 0)
				return container.append('div').classed(className, true);
			else
				return div;
		}
		var titleContainerDiv = checkChild(header, 'title');
		var titleDiv = checkChild(titleContainerDiv, 'title');
		this.setHeightByText(titleContainerDiv.node(), titleDiv, this.offeringName, step);
		
		var orgDiv = checkChild(header, 'organization');
		var organizationDiv = checkChild(orgDiv, 'organization');
		this.setHeightByText(orgDiv.node(), organizationDiv, this.organizationName, step);
	
		var siteContainerDiv = checkChild(header, 'site');
		var siteDiv = checkChild(siteContainerDiv, 'site');
		var siteText = this.siteName != this.organizationName ? this.siteName : null;
		this.setHeightByText(siteContainerDiv.node(), siteDiv, siteText, step);
			
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

		var tagsDiv = checkChild(header, 'tags');
		
		var tags = [];
		
		var offering = this.offering;
		if (offering && offering.getValueID())
		{
			names = offering.getCell("Service").data
				.filter(function(v) { return !v.isEmpty(); });
			tags = tags.concat(names);
		}

		tags = tags.concat(this.services.filter(function(v) 
			{ 
				return !tags.find(function(d) 
					{ 
						return d.getDescription() === v.getDescription(); 
					})
			}));
		
		if (this.domain)
			tags.push(this.domain);
		if (this.stage)
			tags.push(this.stage);
		if (this.serviceDomain)
			tags.push(this.serviceDomain);
			
		tagDivs = tagsDiv.selectAll('span');
		
		for (var j = tagDivs.size(); j > 0; --j)
		{
			var span = tagsDiv.selectAll(':nth-child({0})'.format(j));
			var d = span.datum();
			if (tags.indexOf(d) < 0)
			{
				span.remove();
			}
		}
		
		var ds = tagDivs.data();
		for (var i = 0; i < tags.length; ++i)
		{
			if (ds.indexOf(tags[i]) < 0)
			{
				tagsDiv.append('span')
					.datum(tags[i])
					.classed('tag', true)
					.text(tags[i].getDescription());
			}
		}
	}
	
	Experience.prototype.add = function()
	{
		bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

		var _this = this;
		
		function onCreatedInstance(newData)
		{
			crp.pushCheckCells(newData, ["type"], 
				function() {
					function addExperience() {
						_this.path.getCell("More Experience").addValue(newData);
						$(_this).trigger("experienceAdded.cr", newData);
						unblockClick();
					}
					var offering = newData.getValue("Offering");
					if (offering && offering.getValueID() && !offering.isDataLoaded)
						crp.pushCheckCells(offering, undefined, addExperience, syncFailFunction);
					else
						addExperience();
				},
				syncFailFunction);
		}
		
		field = {ofKind: "More Experience", name: "More Experience"};
		var initialData = {};

		this.appendData(initialData);
		
		cr.createInstance(field, this.path.getValueID(), initialData, onCreatedInstance, syncFailFunction);
	}
	
	Experience.prototype._getInstanceLabel = function(i, name)
	{
		var cell = i.getCell(name);
		if (cell && cell.data.length > 0)
		{
			var labelValue = cell.data[0];
			if (!labelValue.isEmpty())
				return labelValue.getDescription();
		}
		return null;
	}
	
	Experience.prototype._getLabel = function(fieldName, defaultLabel)
	{
		if (this.services.length > 0 && this.services[0].pickedObject)
		{
			var label = this._getInstanceLabel(this.services[0].pickedObject, fieldName);
			if (label)
				return label;
		}
		if (this.serviceDomain)
		{
			var label = this._getInstanceLabel(this.serviceDomain, fieldName);
			if (label)
				return label;
		}
		
		return defaultLabel;
	}
	
	Experience.prototype.getOrganizationLabel = function()
	{
		return this._getLabel("Organization Label", "Organization");
	}
	
	Experience.prototype.getSiteLabel = function()
	{
		return this._getLabel("Site Label", "Site");
	}
	
	Experience.prototype.getOfferingLabel = function()
	{
		return this._getLabel("Offering Label", "Name");
	}
	
	Experience.prototype.createFromData = function(organizationD, siteD, offeringD, services, previousNode, done)
	{
		var _this = this;
		var panel;
		
		this.setOrganization(organizationD);
		m = services.map(function(d) { return _this.addService(d); });
		
		if (siteD)
		{
			this.setSite(siteD);
			if (offeringD)
			{
				this.setOffering(offeringD);
				panel = new NewExperiencePanel(this, previousNode);
			}
			else
			{
				panel = new NewExperiencePanel(this, previousNode);
			}
		}
		else
		{
			panel = new NewExperiencePanel(this, previousNode);
		}
		done(panel.node());
	}
	
	Experience.prototype.createFromOrganization = function(d, services, previousNode, done)
	{
		this.setOrganization({instance: d});
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
			
		var panel = new NewExperiencePanel(this, previousNode);
		done(panel.node());
	}
	
	Experience.prototype.createFromSite = function(d, services, previousNode, done)
	{
		/* Call setOrganization, which recognizes this as a site and does the correct thing. */
		this.setOrganization({instance: d});
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
			
		var panel = new NewExperiencePanel(this, previousNode);
		done(panel.node());
	}

	Experience.prototype.createFromOffering = function(d, services, previousNode, done)
	{
		if (!d.getValue("Organization"))
			throw "Runtime Error: Organization is not present in offering record."
		if (!d.getValue("Site"))
			throw "Runtime Error: Site is not present in offering record."

		this.setOffering({instance: d});
		
		/* Set the organization, then the site, because setting the organization may
			also set the site.
		 */
		this.setOrganization({instance: d.getValue("Organization")});
		this.setSite({instance: d.getValue("Site")});
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
			
		var panel = new NewExperiencePanel(this, previousNode);
		done(panel.node());
	}
	
	Experience.prototype.createFromService = function(d, previousNode, done)
	{
		var service = this.addService(d);
		var panel = new NewExperiencePanel(this, previousNode);
		done(panel.node());
	}
	
	Experience.prototype.getOfferingConstraint = function()
	{
		if (this.services.length > 0 &&
			this.services[0].pickedObject)
			return '[Service={0}]'.format(this.services[0].pickedObject.getValueID());
		else if (this.domain)
			return '[Service[Domain={0}]]'.format(this.domain.getValueID());
		else if (this.serviceDomain)
			return '[Service>Domain["Service Domain"={0}]]'.format(this.serviceDomain.getValueID());
		else if (this.stage)
			return '[Service[Stage={0}]]'.format(this.stage.getValueID());
		else
			return "";
	}
	
	Experience.prototype.getServiceConstraint = function()
	{
		if (this.domain)
			return '[Domain={0}]'.format(this.domain.getValueID());
		else if (this.serviceDomain)
			return '[Domain["Service Domain"={0}]]'.format(this.serviceDomain.getValueID());
		else if (this.stage)
			return '[Stage={0}]'.format(this.stage.getValueID());
		else
			return "";
	}
	
	function Experience(path, dataExperience)
	{
		if (!path)
			throw "path is not specified";
		if (typeof(path) !== "object")
			throw "path is not an object";
			
		this.services = [];
		this.path = path;
		
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

var NamedTypeSearchView = (function() {
	NamedTypeSearchView.prototype = new PanelSearchView();

	NamedTypeSearchView.prototype.hasNamedButton = function(compareText)
	{
		if (compareText.length === 0)
			return true;
		var data = this.listPanel.selectAll("li").data();
		return data.find(function(d) {
				return d.getCell && d.getCell("_name").data.find(
					function(d) { return d.text.toLocaleLowerCase() === compareText;});
			});
	}
	
	/* Returns true if the specified datum has a name that contains compareText. */
	NamedTypeSearchView.prototype.isMatchingDatum = function(d, compareText)
	{
		if (compareText.length === 0)
			return true;
		
		return d.getDescription && 
			   d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
	}
	
	function NamedTypeSearchView(sitePanel, placeholder, appendDescriptions, chunker)
	{
		PanelSearchView.call(this, sitePanel, placeholder, appendDescriptions, chunker)
	}
	
	return NamedTypeSearchView;
	
})();

var MultiTypeSearchView = (function() {
	MultiTypeSearchView.prototype = new NamedTypeSearchView();
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
					if (d.getValue("Site").getDescription() != d.getValue("Organization").getDescription())
					{
						orgDiv.append('div')
							.classed('address-line', true)
							.text(d.getValue("Site").getDescription());
					}
				}
				else if (d.typeName === "Site")
				{
					/* The organization name is either a value of d or, if d is a value
					   of an Offering, then the organization name is the value of the offering.
					 */
					var orgValue;
					if (d.cell && d.cell.parent && d.cell.parent.typeName === "Offering")
						orgValue = d.cell.parent.getValue("Organization");
					else
						orgValue = d.getValue("Organization");
						
					if (orgValue.getDescription() == d.getDescription())
					{
						leftText.text(NewExperienceSearchView.prototype.organizationFormat.format(d.getDescription()));
					}
					else
					{
						orgDiv = leftText.append('div').classed("organization", true);		
						orgDiv.append('div').text(orgValue.getDescription());
						orgDiv.append('div')
							.classed('address-line', true)
							.text(d.getDescription());
					}
				}
				else if (d.typeName === "Organization")
				{
					leftText.text(NewExperienceSearchView.prototype.organizationFormat.format(d.getDescription()));
				}
				else if (d.typeName === "Service")
				{
					leftText.text(NewExperienceSearchView.prototype.tagFormat.format(d.getDescription()));
				}
				else
				{
					leftText.text(d.getDescription());
				}
			}
	
	MultiTypeSearchView.prototype.canConstrain = function(searchText, constrainText)
	{
		/* Force searching if the searchText length is 0. */
		if (!searchText)
			return false;
			
		return SearchView.prototype.canConstrain.call(this, searchText, constrainText);
	}
	
	MultiTypeSearchView.prototype.restartSearchTimeout = function(val)
	{
		this.typeName = this.initialTypeName;
		SearchView.prototype.restartSearchTimeout.call(this, val);
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
		if (sitePanel)
		{
			if (!experience)
				throw "experience is not specified";
			if (typeof(experience) != "object")
				throw "experience is not an object";

			this.experience = experience;
		}
		NamedTypeSearchView.call(this, sitePanel, placeholder, appendDescriptions, GetDataChunker)
	}
	
	return MultiTypeSearchView;
	
})();

var NewExperienceBasePanel = (function() {
	NewExperienceBasePanel.prototype = new SitePanel();
	
	NewExperienceBasePanel.prototype.showNextStep = function(panelNode)
		{
			showPanelLeft(panelNode, unblockClick);
		}
	
	function NewExperienceBasePanel(previousPanelNode, experience, panelClass, showFunction)
	{
		if (previousPanelNode)
		{
			var header = "New Experience";
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

var NewExperienceSearchView = (function() {
	NewExperienceSearchView.prototype = new MultiTypeSearchView();
	NewExperienceSearchView.prototype.typeName = null;
	
	NewExperienceSearchView.prototype.numCustomButtons = 4;
	NewExperienceSearchView.prototype.organizationButton = null;
	NewExperienceSearchView.prototype.customServiceButton = null;
	NewExperienceSearchView.prototype.customOfferingButton = null;
	NewExperienceSearchView.prototype.undoDeleteButton = null;
	NewExperienceSearchView.prototype.undoDelete = null;
	NewExperienceSearchView.prototype.undoDeleteInstance = null;
	
	NewExperienceSearchView.prototype.offeringFormat = "{0}";
	NewExperienceSearchView.prototype.organizationFormat = "At {0}";
	NewExperienceSearchView.prototype.tagFormat = "Tag: {0}";
	
	NewExperienceSearchView.prototype.appendDescriptions = function(buttons)
	{
		buttons.each(this.drawButton);
	}
	
	NewExperienceSearchView.prototype.clearUndoDelete = function()
	{
		this.undoDeleteButton.selectAll("*").remove();
		this.undoDeleteButton.style('display', 'none');
		this.undoDelete = null;
		this.undoDeleteInstance = null;
	}
	
	NewExperienceSearchView.prototype.setupUndoDeleteObject = function(d)
	{
		var _this = this;
		this.undoDeleteInstance = d;
		this.undoDelete = function()
		{
			_this.onClickButton(d, 0);
			_this.clearUndoDelete();
		}
		this.undoDeleteButton.selectAll("*").remove();
		this.drawButton.call(this.undoDeleteButton.node(), d);
		this.undoDeleteButton.style('display', null);
	}
	
	NewExperienceSearchView.prototype.setPlaceholder = function()
	{
		var placeholder;
		
		if (this.experience.offeringName)
		{
			placeholder = "Tag";
		}
		else if (this.experience.siteName)
		{
			placeholder = this.experience.getOfferingLabel();
			if (this.experience.services.length == 0)
				placeholder += " or Tag";
		}
		else if (this.experience.organizationName)
		{
			if (this.experience.services.length == 0)
			{
				placeholder = (this.experience.organization ? "{0}, {1} or Tag" : "{1} or Tag").format(this.experience.getSiteLabel(), 
													this.experience.getOfferingLabel());
			}
			else
			{
				placeholder = (this.experience.organization ? "{0} or {1}" : "{1}").format(this.experience.getSiteLabel(), 
													this.experience.getOfferingLabel());
			}
		}
		else if (this.experience.services.length > 0)
		{
			if (this.experience.services[0].pickedObject)
			{
				placeholder = "{0}, {1} or {2}".format(this.experience.getOrganizationLabel(), 
													 this.experience.getSiteLabel(), 
													 this.experience.getOfferingLabel());
			}
			else
			{
				placeholder = "{0} or {1}".format(this.experience.getOrganizationLabel(), 
												  this.experience.getSiteLabel());
			}
		}
		else
			placeholder = "{0}, {1}, {2} or Tag".format(this.experience.getOrganizationLabel(), 
													 this.experience.getSiteLabel(), 
													 this.experience.getOfferingLabel());
		this.inputBox.setAttribute('placeholder', placeholder);
	}
	
	NewExperienceSearchView.prototype.onUpdatedExperience = function()
	{
		var _this = this;
		this.experience.appendView(this.sitePanel.experienceView, 
			function() {
				_this.sitePanel.calculateHeight();
			});
		this.sitePanel.experienceView.selectAll('.title>.title')
			.on('click', function()
				{
					if (prepareClick('click', 'remove offering: ' + _this.experience.offeringName))
					{
						if (_this.experience.offering)
						{
							_this.setupUndoDeleteObject(_this.experience.offering);
							_this.experience.clearOffering();
						}
						else
						{
							var customText = _this.experience.offeringName;
							_this.undoDelete = function()
							{
								_this.onClickCustomOffering(customText);
								_this.clearUndoDelete();
							}
							_this.undoDeleteButton.selectAll("*").remove();
							_this.undoDeleteButton.append('div').classed("left-expanding-div description-text", true)
								.text(_this.offeringFormat.format(customText));
							_this.undoDeleteButton.style('display', null);
							_this.experience.clearOffering();
						}
						_this.onUpdatedExperience();
						unblockClick();
					}
				});
		
		this.sitePanel.experienceView.selectAll('.organization>.organization')
			.on('click', function()
				{
					if (prepareClick('click', 'remove organization: ' + _this.experience.organizationName))
					{
						if (_this.experience.organization)
						{
							if (_this.experience.offering)
							{
								_this.setupUndoDeleteObject(_this.experience.offering);
								_this.experience.clearOffering();
								_this.experience.clearSite();
								_this.experience.clearOrganization();
							}
							else if (_this.experience.site)
							{
								_this.setupUndoDeleteObject(_this.experience.site);
								_this.experience.clearSite();
								_this.experience.clearOrganization();
							}
							else
							{
								_this.setupUndoDeleteObject(_this.experience.organization);
								_this.experience.clearOrganization();
							}
						}
						else
						{
							var customText = _this.experience.organizationName;
							_this.undoDelete = function()
							{
								_this.onClickCustomOrganization(customText);
								_this.clearUndoDelete();
							}
							_this.undoDeleteButton.selectAll("*").remove();
							_this.undoDeleteButton.append('div').classed("left-expanding-div description-text", true)
								.text(_this.organizationFormat.format(_this.experience.organizationName));
							_this.undoDeleteButton.style('display', null);
							_this.experience.clearOrganization();
						}
						_this.onUpdatedExperience();
						unblockClick();
					}
				});
		
		this.sitePanel.experienceView.selectAll('.site>.site')
			.on('click', function(d)
				{
					if (prepareClick('click', 'remove site: ' + _this.experience.siteName))
					{
						if (_this.experience.site)
						{
							if (_this.experience.offering)
							{
								_this.setupUndoDeleteObject(_this.experience.offering);
								_this.experience.clearOffering();
								_this.experience.clearSite();
							}
							else
							{
								_this.setupUndoDeleteObject(_this.experience.site);
								_this.experience.clearSite();
							}
						}
						else
						{
							var customText = _this.experience.siteName;
							_this.undoDelete = function()
							{
								_this.onClickCustomSite(customText);
								_this.clearUndoDelete();
							}
							_this.undoDeleteButton.selectAll("*").remove();
							_this.undoDeleteButton.append('div').classed("left-expanding-div description-text", true)
								.text('At "{0}"'.format(customText));
							_this.undoDeleteButton.style('display', null);
							_this.experience.clearSite();
						}
						_this.onUpdatedExperience();
						unblockClick();
					}
				});
		
		this.sitePanel.experienceView.selectAll('.tags>.tag')
			.on('click', function(d)
				{
					/* d can be a service domain, a stage or a reported object that contains a service by name or text. */
					if (d.typeName == "Service Domain")
					{
						if (prepareClick('click', 'remove service domain: ' + d.getDescription()))
						{
							try
							{
								_this.setupUndoDeleteObject(d);
								_this.experience.serviceDomain = null;
								_this.onUpdatedExperience();
								unblockClick();
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
					}
					else if (d.typeName == "Domain")
					{
						if (prepareClick('click', 'remove domain: ' + d.getDescription()))
						{
							try
							{
								_this.setupUndoDeleteObject(d);
								_this.experience.domain = null;
								_this.onUpdatedExperience();
								unblockClick();
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
					}
					else if (d.typeName == "Stage")
					{
						if (prepareClick('click', 'remove stage: ' + d.getDescription()))
						{
							try
							{
								_this.setupUndoDeleteObject(d);
								_this.experience.stage = null;
								_this.onUpdatedExperience();
								unblockClick();
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
					}
					else if (d.cell && d.cell.parent && d.cell.parent.typeName == "Offering")
					{
						/* In this case, the service is tied to the offering and can't be deleted. */
						asyncFailFunction('"{1}" is associated with "{0}" and cannot be deleted separately.'.format(d.cell.parent.getDescription(), d.getDescription()));
					}
					else
					{
						if (prepareClick('click', 'remove service: ' + d.getDescription()))
						{
							try
							{
								if (d.pickedObject)
								{
									_this.setupUndoDeleteObject(d.pickedObject);
								}
								else
								{
									var customText = d.getDescription();
									_this.undoDelete = function()
									{
										_this.onClickCustomService(customText);
										_this.clearUndoDelete();
									}
									_this.undoDeleteButton.selectAll("*").remove();
									_this.undoDeleteButton.append('div').classed("left-expanding-div description-text", true)
										.text(_this.tagFormat.format(customText));
									_this.undoDeleteButton.style('display', null);
								}
								_this.experience.removeService(d);
								_this.onUpdatedExperience();
								unblockClick();
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
					}
				});
		
		this.setPlaceholder();
		setTimeout(function() 
			{
				_this.sitePanel.calculateHeight();
			}, 0);
		this.inputText("");
	}
	
	NewExperienceSearchView.prototype.onExperienceDataAdded = function()
	{
		this.onUpdatedExperience();
		this.clearUndoDelete();
	}
	
	NewExperienceSearchView.prototype.onClickCustomOffering = function(customText)
	{
		if (prepareClick('click', 'Custom Offering: ' + customText))
		{
			try
			{
				this.experience.setOffering({text: customText});
				this.onExperienceDataAdded();
				unblockClick();
			}
			catch(err)
			{
				syncFailFunction(err);
			}
		}
	}
	
	NewExperienceSearchView.prototype.onClickCustomOrganization = function(customText)
	{
		if (prepareClick('click', 'Custom Organization: ' + customText))
		{
			try
			{
				if (!this.experience.organizationName)
					this.experience.setOrganization({text: customText});
				else if (!this.experience.siteName)
					this.experience.setSite({text: customText});
				else
					throw "Site and Organization are already set";
				this.onExperienceDataAdded();
				unblockClick();
			}
			catch(err)
			{
				syncFailFunction(err);
			}
		}
	}
	
	NewExperienceSearchView.prototype.onClickCustomService = function(customText)
	{
		if (prepareClick('click', 'Custom Service: ' + customText))
		{
			try
			{
				var service = this.experience.addService({text: customText});
				this.onExperienceDataAdded();
				unblockClick();
			}
			catch(err)
			{
				syncFailFunction(err);
			}
		}
	}
			
	NewExperienceSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === 'Service Domain')
		{
			if (prepareClick('click', 'service domain: ' + d.getDescription()))
			{
				this.experience.serviceDomain = d;
				this.onExperienceDataAdded();
				unblockClick();
			}
		}
		else if (d.typeName === 'Domain')
		{
			if (prepareClick('click', 'domain: ' + d.getDescription()))
			{
				this.experience.domain = d;
				this.onExperienceDataAdded();
				unblockClick();
			}
		}
		else if (d.typeName === 'Stage')
		{
			if (prepareClick('click', 'stage: ' + d.getDescription()))
			{
				this.experience.stage = d;
				this.onExperienceDataAdded();
				unblockClick();
			}
		}
		else if (d.typeName === 'Service')
		{
			if (prepareClick('click', 'service: ' + d.getDescription()))
			{
				if (!this.experience.offeringName &&
					this.experience.services.find(function(d2)
						{
							return d2.pickedObject && d2.pickedObject.getValueID() == d.getValueID();
						}))
					this.experience.setOffering({text: d.getDescription() });
				else
					this.experience.addService({instance: d});
				this.onExperienceDataAdded();
				unblockClick();
			}
		}
		else if (d.typeName === 'Organization')
		{
			if (prepareClick('click', 'organization: ' + d.getDescription()))
			{
				this.experience.setOrganization({instance: d});
				this.onExperienceDataAdded();
				unblockClick();
			}
		}
		else if (d.typeName === 'Site')
		{
			if (prepareClick('click', 'site: ' + d.getDescription()))
			{
				/* Need to check the cells in case this site was a value within an offering. */
				crp.pushCheckCells(d, ["parents"], function()
					{
						_this.experience.setOrganization({instance: d});
						_this.onExperienceDataAdded();
						unblockClick();
					},
					syncFailFunction);
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
				this.onExperienceDataAdded();
				unblockClick();
			}
		}
		d3.event.preventDefault();
	}
	
	NewExperienceSearchView.prototype.hasUniqueSite = function(d)
	{
		var compareText = d.getDescription();
	
		var data = this.listPanel.selectAll("li").data();
		return data.find(function(d) {
				return d.typeName === "Site" &&
					   d.getDescription() === compareText &&
					   d.getValue("Organization").getDescription() === compareText;
			});
		return false;
	}
	
	NewExperienceSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (button == this.undoDeleteButton.node())
			return this.undoDelete != null;
		else if (button == this.customServiceButton.node())
		{
			if (this.hasNamedButton(compareText))
				return false;
			else if (this.experience.services.find(function(d2) {
					return d2.getDescription().toLocaleLowerCase() === compareText;
				}))
				return false;
			else
				return true;
		}
		else if (button == this.organizationButton.node())
			return !this.hasNamedButton(compareText) && (!this.experience.organizationName || !this.experience.siteName);
		else if (button == this.customOfferingButton.node())
			return !this.hasNamedButton(compareText) && !this.experience.offeringName;
		else
		{
			if (this.undoDeleteInstance &&
				d.getValueID() == this.undoDeleteInstance.getValueID())
				return false;
				
			if (d.typeName === "Service")
			{
				if (this.experience.offering && 
					this.experience.offering.getCell("Service").find(d))
					return false;
				if (this.experience.offeringName &&
					this.experience.services.find(function(d2) { 
					return d2.pickedObject && d2.pickedObject.getValueID() == d.getValueID(); 
				}))
					return false;
			}
				
			if (this.experience.offeringName)
			{
				return this.isMatchingDatum(d, compareText);
			}
			else if (this.experience.siteName || this.experience.organizationName)
			{
				if (this.isMatchingDatum(d, compareText))
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
			else if (this.experience.services.length > 0)
			{
				/* Do not display organizations if there is a site with the same name. */
				if (d.typeName === "Organization" &&
					this.hasUniqueSite(d))
					return false;
				
				if (this.isMatchingDatum(d, compareText))
					return true;

				var s = d.getValue("Site");
				if (s && s.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
					return true;
				var org = d.getValue("Organization");
				if (org && org.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0)
					return true;
				return false;
			}
			else
			{
				return this.isMatchingDatum(d, compareText);
			}
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
		var _this = this;
		buttons = buttons.filter(function(d, i) { return i >= _this.numCustomButtons; });
			
		buttons.remove();
		this.organizationButton.style("display", "none");
		this.customServiceButton.style("display", "none");
		this.customOfferingButton.style("display", "none");
	}
	
	NewExperienceSearchView.prototype.searchPath = function(val)
	{
		var path;
		if (this.experience.offering)
		{
			if (!val)
			{
				return "Service";
			}
			else
			{
				path = 'Service[_name{0}"{1}"]';
			
				var symbol = val.length < 3 ? "^=" : "*=";
			
				return path.format(symbol, val);
			}
		}
		else if (this.experience.siteName)
		{
			if (this.experience.site == null)
			{
				return "Service";	/* Can't look up offerings for a custom site name. */
			}
			else if (!val)
			{
				if (this.typeName === "Offering")
				{
					path = "#{0}>Offerings>Offering".format(this.experience.site.getValueID());
					path += this.experience.getOfferingConstraint();
					return path;
				}
				else if (this.typeName === "Service")
				{
					path = "#{0}>Offerings>Offering>Service".format(this.experience.site.getValueID());
					path += this.experience.getServiceConstraint();
					return path;
				}
				else
					return "Service";
			}
			else
			{
				if (this.typeName === "Offering")
				{
					path = 'Offering[_name{0}"{1}"]';
					path = "#{0}>Offerings>".format(this.experience.site.getValueID()) + path;
					path += this.experience.getOfferingConstraint();
				}
				else if (this.typeName === "Service")
				{
					path = 'Service[_name{0}"{1}"]';
					path += this.experience.getServiceConstraint();
				}
			
				var symbol = val.length < 3 ? "^=" : "*=";
			
				return path.format(symbol, val);
			}
		}
		else if (this.experience.organizationName)
		{
			if (this.experience.organization == null)
			{
				if (this.experience.services.length == 0)
				{
					path = "Service";	/* Can't look up offerings for a custom organization name. */
					path += this.experience.getServiceConstraint();
					return path;
				}
				else
					return "";
			}
			else if (!val)
			{
				if (this.typeName === "Site")
					return "#{0}>Sites>Site".format(this.experience.organization.getValueID());
				else if (this.typeName === "Offering from Site")
				{
					path = "#{0}>Sites>Site>Offerings>Offering".format(this.experience.organization.getValueID());
					path += this.experience.getOfferingConstraint();
					return path;
				}
				else if (this.typeName === "Service")
				{
					if (this.experience.services.length == 0)
					{
						path = "#{0}>Sites>Site>Offerings>Offering>Service".format(this.experience.organization.getValueID());
						path += this.experience.getServiceConstraint();
						return path;
					}
					else
						return "";
				}
				else
					return "Service";
			}
			else
			{
				if (this.typeName === "Offering")
				{
					path = 'Offering[_name{0}"{1}"]::not(Site[_name{0}"{1}"]>Offerings>Offering)';
					path = "#{0}>Sites>Site>Offerings>".format(this.experience.organization.getValueID()) + path;
					path += this.experience.getOfferingConstraint();
				}
				else if (this.typeName === "Offering from Site")
				{
					path = 'Site[_name{0}"{1}"]>Offerings>Offering';
					path = "#{0}>Sites>".format(this.experience.organization.getValueID()) + path;
					path += this.experience.getOfferingConstraint();
				}
				else if (this.typeName === "Site")
				{
					path = 'Site[_name{0}"{1}"]';
					path = "#{0}>Sites>".format(this.experience.organization.getValueID()) + path;
				}
				else if (this.typeName === "Service")
				{
					if (this.experience.services.length > 0)
						return "";

					path = 'Service[_name{0}"{1}"]';
					path += this.experience.getServiceConstraint();
				}
			
				var symbol = val.length < 3 ? "^=" : "*=";
			
				return path.format(symbol, val);
			}
		}
		else if (this.experience.services.length > 0)
		{
			if (!val)
			{
				path = "Offering";
				path += this.experience.getOfferingConstraint();
				return path;
			}
			else
			{
				if (this.typeName === "Offering")
				{
					path = 'Offering[_name{0}"{1}"]::not(Site[_name{0}"{1}"]>Offerings>Offering)';
					path += this.experience.getOfferingConstraint();
				}
				else if (this.typeName === "Offering from Site")
				{
					path = 'Site[_name{0}"{1}"]>Offerings>Offering';
					path += this.experience.getOfferingConstraint();
				}
				else if (this.typeName === "Site from Organization")
				{
					if (this.experience.services[0].pickedObject)
					{
						path = 'Organization[_name{0}"{1}"]>Sites>Site::not(Site[_name{0}"{1}"])';
						path += '[Offerings>Offering[Service={0}]]'.format(this.experience.services[0].pickedObject.getValueID());
					}
					else
						return ""
				}
				else if (this.typeName === "Site")
				{
					path = 'Site[_name{0}"{1}"]';
				}
				else if (this.typeName === "Organization")
				{
					path = 'Organization[_name{0}"{1}"]';
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			

				var symbol = val.length < 3 ? "^=" : "*=";
			
				return path.format(symbol, val);
			}
		}
		else if (this.experience.serviceDomain ||
				 this.experience.domain ||
				 this.experience.stage)
		{
			path = "Service" + this.experience.getServiceConstraint();
		
			if (!val)
				return path;
			else if (val.length < 3)
				return '{1}[_name^="{0}"]'.format(val, path);
			else
				return '{1}[_name*="{0}"]'.format(val, path);
		}
		else
			return '::NewExperience:'+val;
	}
	
	NewExperienceSearchView.prototype.textChanged = function()
	{
		SearchView.prototype.textChanged.call(this);

		var val = this.inputText();
		
		this.customOfferingButton.selectAll('.description-text').text(this.offeringFormat.format(val));
		this.organizationButton.selectAll('.description-text').text(this.organizationFormat.format(val));
		this.customServiceButton.selectAll('.description-text').text(this.tagFormat.format(val));
	}
	
	NewExperienceSearchView.prototype.startSearchTimeout = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experience.offeringName)
		{
			this.typeNames = ["Service"];
		}
		else if (this.experience.siteName)
		{
			if (this.experience.services.length > 0)
				this.typeNames = ["Offering", "Service"];
			else
				this.typeNames = ["Offering"];
		}
		else if (this.experience.organizationName)
		{
			if (this.experience.organization)
			{
				if (searchText && searchText.length > 0)
					this.typeNames = ["Offering from Site", "Offering", "Site", "Service"];
				else
					this.typeNames = ["Offering from Site", "Site", "Service"];
			}
			else
			{
				this.typeNames = ["Service"];
			}
		}
		else if (this.experience.services.length > 0)
		{
			if (this.experience.services[0].pickedObject)
			{
				if (searchText && searchText.length > 0)
					this.typeNames = ["Offering from Site", "Offering", "Site", "Organization", "Site from Organization"];
				else
					this.typeNames = ["Offering"];
			}
			else
				this.typeNames = ["Site", "Organization", "Site from Organization"];
		}
		else if (this.experience.serviceDomain || this.experience.stage || this.experience.domain)
		{
			this.typeNames = ["Service"];
		}
		else
		{
			this.typeNames = ["::NewExperience"];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
		SearchView.prototype.startSearchTimeout.call(this, searchText);
	}
				
	/* In addition to calling the base class function, show the custom buttons if there
		is inputText and there isn't data already in the location associated with the button.
	 */
	NewExperienceSearchView.prototype.cancelSearch = function()
	{
		SearchView.prototype.cancelSearch.call(this);
		this.customServiceButton.style("display", this.inputText().length > 0 ? null : "none");
		this.organizationButton.style("display", 
			(this.inputText().length > 0  && (!this.experience.organizationName || !this.experience.siteName)) ? null : "none");
		this.customOfferingButton.style("display", 
			(this.inputText().length > 0  && !this.experience.offeringName) ? null : "none");
	}
	
	NewExperienceSearchView.prototype.restartSearchTimeout = function(val)
	{
		if (this.typeNames[0] === "::NewExperience")
			this.startSearchTimeout.call(this, val);
		else
		{
			this.typeName = this.typeNames[0];
			SearchView.prototype.restartSearchTimeout.call(this, val);
		}
	}
				

	function NewExperienceSearchView(sitePanel, experience)
	{
		this.typeNames = ["::NewExperience"];
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.initialTypeName;
		MultiTypeSearchView.call(this, sitePanel, experience, "Search", function(buttons) { _this.appendDescriptions(buttons); })
		
		var _this = this;

		this.undoDeleteButton = appendViewButtons(this.appendButtonContainers(["UndoDelete"]),
			function(buttons)
			{
				buttons.append('div').classed("left-expanding-div description-text", true);
			})
			.on('click', function(d, i) {
				_this.undoDelete();
			})
			.style('display', 'none');
		this.customOfferingButton = appendViewButtons(this.appendButtonContainers(["ServiceIsOffering"]),
				function(buttons)
				{
					buttons.append('div').classed("left-expanding-div description-text", true);
				}
			)
			.on("click", function(d, i) {
				_this.onClickCustomOffering(_this.inputText());
			})
			.style('display', 'none');
		var sections = this.appendButtonContainers(["Organization"]);
		this.organizationButton = appendViewButtons(sections, 
					function(buttons)
					{
						buttons.append('div').classed("left-expanding-div description-text", true);
					}
			)
			.on("click", function(d, i) {
				_this.onClickCustomOrganization(_this.inputText());
			})
			.style("display", "none");

		sections = this.appendButtonContainers(["Service"]);
		this.customServiceButton = appendViewButtons(sections,  
					function(buttons)
					{
						buttons.append('div').classed("left-expanding-div description-text", true);
					}
			)
			.on("click", function(d, i) {
				_this.onClickCustomService(_this.inputText());
			})
			.style("display", "none");
			
		this.setPlaceholder();

		this.getDataChunker._onDoneSearch = function()
			{
				var searchText = _this._foundCompareText;
				var i = _this.typeNames.indexOf(_this.typeName);
				if (i < _this.typeNames.length - 1)
				{
					_this.typeName = _this.typeNames[i+1];
					this.path = _this.searchPath(searchText);
					this.fields = _this.fields();
					this.checkStart(searchText);
				}
			};
	}
	
	return NewExperienceSearchView;
})();

/* This is the entry panel for the workflow. The experience contains no data on entry. 
	This panel can specify a search domain or, with typing, pick a service, offering, organization or site.
	One can also specify a custom service or a custom organization. */
var NewExperiencePanel = (function () {
	NewExperiencePanel.prototype = new NewExperienceBasePanel();
	
	NewExperiencePanel.prototype.previousExperienceLabel = "Previous";
	NewExperiencePanel.prototype.currentExperienceLabel = "Current";
	NewExperiencePanel.prototype.goalLabel = "Goal";
	NewExperiencePanel.prototype.nameOrTagRequiredMessage = 'Your experience needs at least a name or a tag.';
	NewExperiencePanel.prototype.previousStartYearAndMonthRequiredMessage = 'You need to set the start year and month for this previous experience.';
	NewExperiencePanel.prototype.previousEndYearAndMonthRequiredMessage = 'You need to set the end year and month for this previous experience.';
	NewExperiencePanel.prototype.currentStartYearAndMonthRequiredMessage = 'You need to set the start year and month for this current experience.';
	
	NewExperiencePanel.prototype.appendHidableDateInput = function(dateContainer, minDate, maxDate)
	{
		var _this = this;
		var itemsDiv = dateContainer.append('ol');
		var itemDiv = itemsDiv.append('li');
		var dateInput = new DateInput(itemDiv.node(), minDate, maxDate);
		var hidableDiv = new HidableDiv(dateContainer.selectAll(".date-row").node());

		var hidingChevron = new HidingChevron(itemDiv, 
			function()
			{
				hidableDiv.show(function()
					{
						unblockClick();
					});
				showNotSureSpan(200,
					function()
					{
						_this.calculateHeight();
					})
			});
		
		var notSureSpan = dateContainer.append('div')
				.classed('in-cell-button site-active-text', true)
				.on('click', function()
					{
						if (prepareClick('click', "Not Sure"))
						{
							hidableDiv.hide(function()
								{
									hidingChevron.show(function()
										{
											dateInput.clear();
											unblockClick();
										});
								});
							hideNotSureSpan(200,
								function()
								{
									_this.calculateHeight();
								}
							);
						}
					});
		notSureSpan.append('div').text('Not Sure');
		
		var showNotSureSpan = function(duration, step, done)
			{
				var jNode = $(notSureSpan.node());
				notSureSpan.selectAll('div').style('display', '');
				if (!duration)
				{
					jNode.height('auto');
					if (step) step();
					if (done) done();
				}
				else
				{
					var oldHeight = jNode.height();
					jNode.height('auto');
					var height = jNode.height();
					jNode.height(oldHeight);
					jNode.animate({height: height}, {duration: duration, easing: 'swing', step: step, done: done});
				}
			}
			
		var hideNotSureSpan = function(duration, step, done)
			{
				var jNode = $(notSureSpan.node());
				if (!duration)
				{
					jNode.height('0');
					if (step) step();
					if (done) done();
					notSureSpan.selectAll('div').style('display', 'none');
				}
				else
				{
					jNode.animate({height: "0px"}, {duration: duration, easing: 'swing', step: step, done: 
						function() {
							notSureSpan.selectAll('div').style('display', 'none');
							if (done) done();
						}});
				}
			}
			
		forceDateVisible = function(duration, done)
			{
				hideNotSureSpan(duration,
					function()
					{
						_this.calculateHeight();
					}
				);
				hidingChevron.hide(
					function()
					{
						hidableDiv.show(function()
						{
							if (done) done();
						})
					});
			}
		
		/* Calculate layout-based variables after css is complete. */
		setTimeout(function()
			{
				hidingChevron.height(hidableDiv.height());
			}, 0);
		
		return {dateInput: dateInput, hidableDiv: hidableDiv, 
			showNotSureSpan: showNotSureSpan,
			hideNotSureSpan: hideNotSureSpan,
			forceDateVisible: forceDateVisible
		};
	}
	
	function NewExperiencePanel(experience, previousPanelNode, phase) {

		NewExperienceBasePanel.call(this, previousPanelNode, experience, "edit experience new-experience-panel", revealPanelUp);
		var _this = this;
		
		var stepFunction = function()
			{
				_this.calculateHeight();
			}
			
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
		
		var nextButton = navContainer.appendRightButton()
			.classed("site-active-text", true)
			.classed("default-link", true)
			.on("click", function()
			{
				function doAdd()
				{
					if (prepareClick('click', 'NewExperiencePanel: Add'))
					{
						experience.startDate = startDateInput.value();
						experience.endDate = endDateInput.value();
					
						experience.add();
					}
				}
				
				if (!experience.offeringName &&
					experience.services.length == 0)
					asyncFailFunction(_this.nameOrTagRequiredMessage);
				else if (previousExperienceButton.classed('pressed'))
				{
					if (!startDateInput.year || !startDateInput.month)
						asyncFailFunction(_this.previousStartYearAndMonthRequiredMessage);
					else if (!endDateInput.year || !endDateInput.month)
						asyncFailFunction(_this.previousEndYearAndMonthRequiredMessage);
					else
					{
						doAdd();
					}
				}
				else if (currentExperienceButton.classed('pressed'))
				{
					if (!startDateInput.year || !startDateInput.month)
						asyncFailFunction(_this.currentStartYearAndMonthRequiredMessage);
					else
					{
						doAdd();
					}
				}
				else if (goalButton.classed('pressed'))
				{
					doAdd();
				}
				else
					asyncFailFunction('No timing button is pressed.');
				d3.event.preventDefault();
			});
		nextButton.append("span").text("Add");
		
		navContainer.appendTitle(this.headerText);
						
		this.experienceView = this.panelDiv.append('header');
		
		var searchView = new NewExperienceSearchView(this, experience);
		
		var birthday = experience.path.getDatum("Birthday");
		
		var optionPanel = this.panelDiv.append('section')
			.classed('date-range-options', true);
		var previousExperienceButton = optionPanel.append('button')
			.classed('previous', true)
			.on('click', function()
				{
					currentExperienceButton.classed('pressed', false);
					goalButton.classed('pressed', false);
					previousExperienceButton.classed('pressed', true);
					startHidable.forceDateVisible(200);
					endHidable.forceDateVisible(200);
					
					startDateInput.checkMinDate(new Date(birthday), new Date());
					$(startDateInput).trigger('change');
				})
			.text(this.previousExperienceLabel);
		
		var currentExperienceButton = optionPanel.append('button')
			.classed('present', true)
			.on('click', function()
				{
					goalButton.classed('pressed', false);
					previousExperienceButton.classed('pressed', false);
					currentExperienceButton.classed('pressed', true);
					startHidable.forceDateVisible(200);
					endHidable.showNotSureSpan(200, stepFunction);
					
					startDateInput.checkMinDate(new Date(birthday), new Date());
					$(startDateInput).trigger('change');
				})
			.text(this.currentExperienceLabel);
		
		var goalButton = optionPanel.append('button')
			.classed('goal', true)
			.on('click', function()
				{
					previousExperienceButton.classed('pressed', false);
					currentExperienceButton.classed('pressed', false);
					goalButton.classed('pressed', true);
					startHidable.showNotSureSpan(200, stepFunction);
					if (endHidable.hidableDiv.isVisible())
						endHidable.showNotSureSpan(200, stepFunction);
					
					var startMaxDate = new Date();
					startMaxDate.setUTCFullYear(startMaxDate.getUTCFullYear() + 50);
					startDateInput.checkMinDate(new Date(), startMaxDate);
					$(startDateInput).trigger('change');
				})
			.text(this.goalLabel);
			
		var startDateContainer = this.panelDiv.append('section')
			.classed('cell unique date-container', true);

		startDateContainer.append('label')
			.text("Start");
		var startHidable = this.appendHidableDateInput(startDateContainer, new Date(birthday));
		var startDateInput = startHidable.dateInput;
		
		$(startDateInput).on('change', function() {
			var minEndDate, maxEndDate;
			if (previousExperienceButton.classed('pressed'))
			{
				if (this.value() && this.value().length > 0)
					minEndDate = new Date(this.value());
				else if (birthday)
					minEndDate = new Date(birthday);
				else
					minEndDate = new Date();
			}
			else if (currentExperienceButton.classed('pressed'))
			{
				minEndDate = new Date();
			}
			else
			{
				if (this.value() && this.value().length > 0)
					minEndDate = new Date(this.value());
				else
					minEndDate = new Date();
			}
			
			if (previousExperienceButton.classed('pressed'))
			{
				maxEndDate = new Date();
			}
			else
			{
				maxEndDate = new Date();
				maxEndDate.setUTCFullYear(maxEndDate.getUTCFullYear() + 50);
			}
				
			endDateInput.checkMinDate(minEndDate, maxEndDate);
		});
		
		var endDateContainer = this.panelDiv.append('section')
			.classed('cell unique date-container', true);
		var endLabel = endDateContainer.append('label')
			.text("End");
			
		var endHidable = this.appendHidableDateInput(endDateContainer, new Date(birthday));
		var endDateInput = endHidable.dateInput;
		
		startHidable.hideNotSureSpan(0, function() {});
		endHidable.hideNotSureSpan(0, function() {});
		
		setTimeout(function()
			{
				if (phase == 'Current')
					$(currentExperienceButton.node()).trigger('click');
				else if (phase == 'Goal')
					$(goalButton.node()).trigger('click')
				else
					$(previousExperienceButton.node()).trigger('click');
					
				experience.appendView(_this.experienceView, stepFunction);
				searchView.search(""); 
				searchView.inputBox.focus();
			});
	}
	
	return NewExperiencePanel;
})();

