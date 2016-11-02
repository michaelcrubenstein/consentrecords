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
	
	/* The instance is an instance to be replaced. */
	Experience.prototype.instance = null;
	
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
		if (this.startDate)
			initialData["Start"] = [{text: this.startDate}];
		if (this.endDate)
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
		
		var existingServices = null;
		if (this.offering && this.offering.getCell("Service"))
			existingServices = this.offering.getCell("Service").data;
			
		if (this.timeframe)
			initialData["Timeframe"] = [{instanceID: this.timeframe.getValueID()}];
				
		for (i = 0; i < this.services.length; ++i)
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
	
	Experience.prototype.appendTags = function(container, tagDivs, addFunction)
	{
		tagDivs = tagDivs !== undefined ? tagDivs : container.selectAll('span');
		addFunction = addFunction !== undefined ? addFunction : function(container, instance)
			{
				container.append('span')
					.datum(instance)
					.classed('tag', true)
					.text(instance.getDescription());
			};
			
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
			
		tagDivs.filter(function(d) { return d != null && tags.indexOf(d) < 0; } ).remove();
		
		var ds = tagDivs.data();
		for (var i = 0; i < tags.length; ++i)
		{
			if (ds.indexOf(tags[i]) < 0)
			{
				addFunction(container, tags[i]);
			}
		}
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
		
		this.appendTags(tagsDiv);
	}
	
	Experience.prototype.add = function(done)
	{
		var _this = this;
	
		if (this.instance)
		{
			var updateData = [];
			var sourceObjects = [];
			this.instance.getValue("Organization").appendUpdateCommands(0, this.organization, updateData, sourceObjects);
			this.instance.getValue("User Entered Organization").appendUpdateCommands(
					0, this.organization ? null : this.organizationName, updateData, sourceObjects);
					
			this.instance.getValue("Site").appendUpdateCommands(0, this.site, updateData, sourceObjects);
			this.instance.getValue("User Entered Site").appendUpdateCommands(
					0, this.site ? null : this.siteName, updateData, sourceObjects);
					
			this.instance.getValue("Offering").appendUpdateCommands(0, this.offering, updateData, sourceObjects);
			this.instance.getValue("User Entered Offering").appendUpdateCommands(
					0, this.offering ? null : this.offeringName, updateData, sourceObjects);
					
			this.instance.getValue("Start").appendUpdateCommands(0, this.startDate, updateData, sourceObjects);	
			this.instance.getValue("End").appendUpdateCommands(0, this.endDate, updateData, sourceObjects);
			
			this.instance.getValue("Timeframe").appendUpdateCommands(0, this.timeframe, updateData, sourceObjects);
			
			var i = 0;
			var j = 0;
			var oldServices = this.instance.getCell("Service");
			
			var existingServices = null;
			if (this.offering && this.offering.getCell("Service"))
				existingServices = this.offering.getCell("Service").data
					.map(function(d) { return d.getValueID(); });

			var newServices = this.services.filter(function(s) {
					return s.pickedObject &&
						(!existingServices || 
					     !existingServices.find(function(d) { 
							return s.pickedObject.getValueID() == d;
							}));
				})
				.map(function(d) { return d.pickedObject; });
			var newUserEnteredServices = this.services.filter(function(d) { return !d.pickedObject; })
				.map(function(d) { return d.name; });
			
			var collateValues = function(cell, newValues, updateData, sourceObjects)
			{
				var j = 0;
				newValues.forEach(function(d)
					{
						if (j < cell.data.length)
						{
							var oldService = cell.data[j];
							oldService.appendUpdateCommands(j, d, updateData, sourceObjects);
							++j;
						}
						else
						{
							updateData.push(cell.getAddCommand(d));
							sourceObjects.push(cell);
						}
					});
				while (j < cell.data.length)
				{
					var oldService = cell.data[j];
					oldService.appendUpdateCommands(j, null, updateData, sourceObjects);
					++j;
				}
			}
			
			collateValues(this.instance.getCell("Service"), newServices, updateData, sourceObjects);
			collateValues(this.instance.getCell("User Entered Service"), newUserEnteredServices, updateData, sourceObjects);
			
			bootstrap_alert.show($('.alert-container'), "Saving Experience...", "alert-info");
			
			cr.updateValues(updateData, sourceObjects)
				.then(function()
					{
						var offering = _this.instance.getValue("Offering");
						if (offering && offering.getValueID() && !offering.isDataLoaded)
							return offering.promiseCellsFromCache();
						else
							return undefined;
					})
				.then(done, cr.syncFail);
		}
		else
		{
			/* Test case: add an experience to a path. */
			bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

			field = {ofKind: "More Experience", name: "More Experience"};
			var initialData = {};

			this.appendData(initialData);
		
			cr.createInstance(field, this.path.getValueID(), initialData)
			 .then(function(newData)
					{
						var r = $.Deferred();
						newData.promiseCellsFromCache(["Offering"])
							.then(function()
								{
									r.resolve(newData);
									return r;
								},
								function(err)
								{
									r.reject(err);
								})
						return r;
					}, 
				   cr.syncFail)
			 .then(function(newData)
			 		{
			 			_this.path.getCell("More Experience").addValue(newData);
			 		})
			 .then(done, cr.syncFail);
		}
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
	
	Experience.prototype.initPreviousDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.startDate = "{0}-{1}".format(todayDate.getUTCFullYear() - 1, todayDate.getUTCMonth() + 1);
		this.endDate = "{0}-{1}".format(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1);
	}
	
	Experience.prototype.initCurrentDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.startDate = "{0}-{1}".format(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1);
		this.endDate = "{0}-{1}".format(todayDate.getUTCFullYear() + 1, todayDate.getUTCMonth() + 1);
	}
	
	Experience.prototype.initGoalDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.startDate = "{0}-{1}".format(todayDate.getUTCFullYear() + 1, todayDate.getUTCMonth() + 1);
		this.endDate = "{0}-{1}".format(todayDate.getUTCFullYear() + 2, todayDate.getUTCMonth() + 1);
	}
	
	Experience.prototype.createFromData = function(organizationD, siteD, offeringD, services, previousNode, done)
	{
		var _this = this;
		var panel;
		
		this.initPreviousDateRange();
		
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
	
	Experience.prototype.createFromSite = function(d, services, previousNode, done)
	{
		this.initPreviousDateRange();
		
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
			throw new Error("Runtime Error: Organization is not present in offering record.")
		if (!d.getValue("Site"))
			throw new Error("Runtime Error: Site is not present in offering record.")

		this.initPreviousDateRange();
		
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
		this.initPreviousDateRange();
		
		var service = this.addService(d);
		var panel = new NewExperiencePanel(this, previousNode);
		done(panel.node());
	}
	
	Experience.prototype.getOfferingConstraint = function()
	{
		if (this.services.length > 0 &&
			this.services[0].pickedObject)
			return '[Service[Service={0}]]'.format(this.services[0].pickedObject.getValueID());
		else if (this.domain)
			return '[Service[Service={0}]]'.format(this.domain.getValueID());
		else if (this.stage)
			return '[Service[Stage={0}]]'.format(this.stage.getValueID());
		else
			return "";
	}
	
	Experience.prototype.replaced = function(instance)
	{
		this.instance = instance;
	}
	
	Experience.prototype.getPhase = function()
	{
		var t = this.instance && this.instance.getValue('Timeframe');
		if (t && t.getValueID())
			return t.getDescription();
			
		var todayDate = getUTCTodayDate().toISOString().substr(0, 10);
		if (!this.startDate || this.startDate > todayDate)
			return 'Goal';
		else if (!this.endDate || this.endDate > todayDate)
			return 'Current';
		else
			return 'Previous';
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
				
			this.startDate = dataExperience.getDatum("Start");
			this.endDate = dataExperience.getDatum("End");
		}
	}
	
	return Experience;
})();

var MultiTypeOptionView = (function() {
	MultiTypeOptionView.prototype = new SearchOptionsView();
	MultiTypeOptionView.prototype.containerNode = null;
	MultiTypeOptionView.prototype.experience = null;
	MultiTypeOptionView.prototype.typeName = "";
	MultiTypeOptionView.prototype.initialTypeName = "";
	
	MultiTypeOptionView.prototype.hasNamedButton = function(compareText)
	{
		if (compareText.length === 0)
			return true;
		var data = this.buttons().data();
		return data.find(function(d) {
				return d.getCell && d.getCell("_name").data.find(
					function(d) { return d.text.toLocaleLowerCase() === compareText;}) ||
					(d.getDescription && d.getDescription().toLocaleLowerCase() === compareText);
			});
	}
	
	MultiTypeOptionView.prototype.stringContains = function(source, target)
	{
		return source.toLocaleLowerCase().search(new RegExp("\\b{0}".format(target))) >= 0;
	}
	
	/* Returns true if the specified datum has a name that contains compareText. */
	MultiTypeOptionView.prototype.isMatchingDatum = function(d, compareText)
	{
		if (compareText.length === 0)
			return true;
		
		return d.getDescription && 
			   this.stringContains(d.getDescription(), compareText);
	}
	
	MultiTypeOptionView.prototype.canConstrain = function(searchText, constrainText)
	{
		/* Force searching if the searchText length is 0. */
		if (!searchText)
			return false;
			
		return SearchOptionsView.prototype.canConstrain.call(this, searchText, constrainText);
	}
	
	MultiTypeOptionView.prototype.restartSearchTimeout = function(val)
	{
		this.typeName = this.initialTypeName;
		SearchOptionsView.prototype.restartSearchTimeout.call(this, val);
	}
				
	MultiTypeOptionView.prototype.startSearchTimeout = function(val)
	{
		this.typeName = this.initialTypeName;
		SearchOptionsView.prototype.startSearchTimeout.call(this, val);
	}
				
	MultiTypeOptionView.prototype.search = function(val)
	{
		if (!this.initialTypeName || !this.initialTypeName.length)
			throw "unset initialTypeName";
			
		this.typeName = this.initialTypeName;
		SearchOptionsView.prototype.search.call(this, val);
	}
	
	MultiTypeOptionView.prototype.appendSearchArea = function()
	{
		return d3.select(this.containerNode).append('ol')
			.classed('search', true);
	}
	
	function MultiTypeOptionView(containerNode, experience, appendDescriptions)
	{
		this.containerNode = containerNode;
		if (containerNode)
		{
			if (!experience)
				throw "experience is not specified";
			if (typeof(experience) != "object")
				throw "experience is not an object";

			this.experience = experience;
		}
		SearchOptionsView.call(this, containerNode, appendDescriptions, GetDataChunker)
	}
	
	return MultiTypeOptionView;
	
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
    
    ReportedObject.prototype.equal = function(v2)
    {
    	if (this.pickedObject)
    		return v2.pickedObject && v2.pickedObject.getValueID() == this.pickedObject.getValueID();
    	else
    		return !v2.pickedObject && this.name == v2.name;
    }
    
    return ReportedObject;
}();

var ExperienceDatumSearchView = (function() {
	ExperienceDatumSearchView.prototype = new MultiTypeOptionView();
	ExperienceDatumSearchView.prototype.typeNames = null;
	ExperienceDatumSearchView.prototype.initialTypeName = null;
	ExperienceDatumSearchView.prototype.typeName = null;
	ExperienceDatumSearchView.prototype.sitePanel = null;
	
	ExperienceDatumSearchView.prototype.inputBox = null;
	ExperienceDatumSearchView.prototype.helpNode = null;

	ExperienceDatumSearchView.prototype.inputText = function(val)
	{
		if (val === undefined)
			return this.inputBox.value.trim();
		else
		{
			this.inputBox.value = val;
			$(this.inputBox).trigger("input");
		}
	}
	
	ExperienceDatumSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === 'Service')
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
				this.sitePanel.onExperienceUpdated();
				this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		else if (d.typeName === 'Organization')
		{
			if (prepareClick('click', 'organization: ' + d.getDescription()))
			{
				try
				{
					/* Clear the site and offering if they aren't within the new organization. */
					if (_this.experience.site &&
						_this.experience.organization &&
						_this.experience.organization.getValueID() != d.getValueID())
					{
						if (this.experience.offering)
						{
							this.experience.clearOffering();
							this.experience.clearSite();
						}
						else
						{
							this.experience.clearSite();
						}
					}
					/* Set the organization and organizationName explicitly so that the site
						isn't cleared inappropriately.
					 */
					this.experience.organization = d;
					this.experience.organizationName = d.getDescription();
					
					this.sitePanel.onExperienceUpdated();
					this.hideSearch(function()
						{
							_this.cancelSearch();
							var newInputNode = _this.sitePanel.siteInput.node();
							newInputNode.focus();
							newInputNode.setSelectionRange(0, newInputNode.value.length);
							unblockClick();
						});
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
		}
		else if (d.typeName === 'Site')
		{
			if (prepareClick('click', 'site: ' + d.getDescription()))
			{
				/* Need to check the cells in case this site was a value within an offering. */
				d.promiseCellsFromCache(["parents"])
					.then(function()
						{
							try
							{
								if (_this.experience.offering &&
									_this.experience.site &&
									_this.experience.site.getValueID() != d.getValueID())
									_this.experience.clearOffering();
								_this.experience.setOrganization({instance: d});
								_this.sitePanel.onExperienceUpdated();
								_this.hideSearch(function()
									{
										_this.cancelSearch();
										var newInputNode = _this.sitePanel.offeringInput.node();
										newInputNode.focus();
										newInputNode.setSelectionRange(0, newInputNode.value.length);
										unblockClick();
									});
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						},
						cr.syncFail);
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
				this.sitePanel.onExperienceUpdated();
				_this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		d3.event.preventDefault();
	}
	
	ExperienceDatumSearchView.prototype.hasUniqueSite = function(d)
	{
		var compareText = d.getDescription();
	
		var data = this.buttons().data();
		return data.find(function(d) {
				return d.typeName === "Site" &&
					   d.getDescription() === compareText &&
					   d.getValue("Organization").getDescription() === compareText;
			});
		return false;
	}
	
	ExperienceDatumSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		/* Do not display organizations if there is a site with the same name. */
		if (d.typeName === "Organization" &&
			this.hasUniqueSite(d))
			return false;
		
		if (this.isMatchingDatum(d, compareText))
			return true;

		if (d.typeName === "Offering")
		{
			if (this.stringContains(d.getValue("Site").getDescription(), compareText))
				return true;
			if (this.stringContains(d.getValue("Organization").getDescription(), compareText))
				return true;
		}
		else if (d.typeName === "Site")
		{
			if (this.stringContains(d.getValue("Organization").getDescription(), compareText))
				return true;
		}
		return false;
	}
	
	ExperienceDatumSearchView.prototype.noResultString = function()
	{
		return "";
	}
	
	ExperienceDatumSearchView.prototype.textCleared = function()
	{
		SearchOptionsView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	ExperienceDatumSearchView.prototype.startSearchTimeout = function(searchText)
	{
		this.setupSearchTypes(searchText);
		this.checkHelp(!this.typeName);
		this.showSearch();
		if (this.typeName)
			SearchOptionsView.prototype.startSearchTimeout.call(this, searchText);
	}
				
	ExperienceDatumSearchView.prototype.restartSearchTimeout = function(val)
	{
		val = val !== undefined ? val : this.inputCompareText();
		this.setupSearchTypes(val);
		this.checkHelp(!this.typeName);
		this.showSearch();
		if (this.typeName)
			SearchOptionsView.prototype.restartSearchTimeout.call(this, val);
	}
	
	ExperienceDatumSearchView.prototype.isSearchVisible = function()
	{
		return $(this.helpNode).css('display') != 'none';
	}
	
	ExperienceDatumSearchView.prototype.hideSearch = function(done)
	{
		var _this = this;

		var jHelpDiv = $(_this.helpNode);
		jHelpDiv.children().remove();
		jHelpDiv.css('display', 'none');
		this.reveal.hide({duration: 200,
						  before: done});
	}
	
	ExperienceDatumSearchView.prototype.showSearch = function(duration, step, done)
	{
		duration = duration !== undefined ? duration : 400;
		var parent = $(this.reveal.node).parent();
		var oldHeight = $(this.reveal.node).height();
		$(this.reveal.node).height(0);
		var newHeight = parent.getFillHeight() - 
						parent.outerHeight(true);
		$(this.reveal.node).height(oldHeight);
		if (oldHeight != newHeight)
		{
			this.reveal.show(
				/* To calculate the new height, get the fill height of the parent (the height of its parent minus the height of all other nodes)
					and subtract the parent's height and add back the reveal node's height. */
				{newHeight: newHeight,
				 children: $(this.listElement.node())},
				duration, step, done);
		}
	}	

	function ExperienceDatumSearchView(containerNode, sitePanel, experience, inputNode, helpNode)
	{
		this.typeNames = [""];
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.initialTypeName;
		this.sitePanel = sitePanel;
		MultiTypeOptionView.call(this, containerNode, experience, 
			function(buttons) { 
				_this.appendDescriptions(buttons); 
			});
		
		var _this = this;

		if (containerNode)
		{
			this.inputBox = inputNode;
			$(this.inputBox).on("input", function() { 
					try { _this.textChanged(); }
					catch(err) { cr.asyncFail(err); }
				});
			
			this.helpNode = helpNode;

			this.reveal = new VerticalReveal(containerNode);
			this.reveal.hide();

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
					else if (!_this.getDataChunker.hasButtons() && !_this.inputText())
					{
						if ("checkHelp" in _this)
						{
							_this.checkHelp(true);
							_this.showSearch();
						}
					}
				};
		}
	}
	
	return ExperienceDatumSearchView;
})();

/* Displays Services. Since the services are taken from the global Services list, this
	search view should never need to interact with the server.
 */
var TagSearchView = (function() {
	TagSearchView.prototype = new ExperienceDatumSearchView();
	
	TagSearchView.prototype.searchPath = function(val)
	{
		throw new Error("TagSearchView.prototype.searchPath should never be called");
	}
	
	TagSearchView.prototype.setupSearchTypes = function(searchText)
	{
		throw new Error("TagSearchView.prototype.setupSearchTypes should never be called");
	}
	
	TagSearchView.prototype.onTagAdded = function()
	{
		this.sitePanel.onExperienceUpdated();
		this.inputBox.value = "";
		$(this.inputBox).trigger('input');
		this.inputBox.focus();
		unblockClick();
	}
	
	TagSearchView.prototype.checkHelp = function(showHelp)
	{
		var helpDiv = d3.select(this.helpNode);
		
		if (showHelp == (helpDiv.style('display') == 'block'))
			return false;
			
		if (showHelp)
		{
			var texts = [{styles: '', text: 'Tags identify the benefits you got out of each experience.'},
						 {styles: '', text: 'When comparing your path with others, tags are used to identify similar experiences.'},
						 ];
			helpDiv.selectAll('p')
				.data(texts)
				.enter()
				.append('p')
				.classed('list', function(d) { return d.styles == 'list'; })
				.text(function(d) { return d.text; });
			helpDiv.style('display', 'block');
		}
		else
		{
			helpDiv.selectAll('p').remove();
			helpDiv.style('display', 'none');
		}
		return true;
	}
	
	TagSearchView.prototype.appendDescriptions = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text", true);
				leftText.text(d.getDescription());
			});
	}
	
	TagSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === 'Service')
		{
			if (prepareClick('click', 'service: ' + d.getDescription()))
			{
				try
				{
					var d3Focus = d3.select(this.focusNode);
					if (d3Focus.datum())
					{
						d3Focus.datum().name = d.getDescription();
						d3Focus.datum().pickedObject = d;
						this.focusNode.value = d.getDescription();
						this.onTagAdded();
					}
					else
					{
						this.experience.addService({instance: d});
						this.onTagAdded();
					}
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
		}
		d3.event.preventDefault();
	}
	
	TagSearchView.prototype.isButtonVisible = function(button, d, compareText, inputNode)
	{
		if (d.getDescription().toLocaleLowerCase() == compareText)
			return true;
			
		if (d.typeName === "Service")
		{
			if (this.experience.offering && 
				this.experience.offering.getCell("Service").find(d))
				return false;
			if (this.experience.services.find(function(d2) { 
				return d2.pickedObject && d2.pickedObject.getValueID() == d.getValueID() &&
					!(inputNode && d3.select(inputNode).datum() == d2) ; 
			}))
				return false;
			
			/* TODO: After moving this to the main line, look for a Service instead of comparing domain names. */
			var domain = this.experience.domain;
			if (domain &&
				!d.getCell("Service").data.find(function(d)
					{
						return d.getDescription() == domain.getDescription();
					}))
				return false;
			if (this.experience.stage &&
				!d.getCell("Stage").find(this.experience.stage))
				return false;
		}
			
		if (this.isMatchingDatum(d, compareText))
			return true;

		return false;
	}
	
	TagSearchView.prototype.constrainFoundObjects = function(inputNode)
	{
		var constrainText = inputNode ? inputNode.value.trim().toLocaleLowerCase() : this.sitePanel.getTagConstrainText();
		var buttons = this.listElement.selectAll(".btn");
		var _this = this;
		buttons.style("display", function(d) 
			{ 
				if (_this.isButtonVisible(this, d, constrainText, inputNode))
					return null;
				else
					return "none";
			});
	}
	
	TagSearchView.prototype.textCleared = function()
	{
		this.setConstrainText("");
		SearchOptionsView.prototype.constrainFoundObjects.call(this);
	}
	
	TagSearchView.prototype.restartSearchTimeout = function(val)
	{
		this.setConstrainText(val);
		SearchOptionsView.prototype.constrainFoundObjects.call(this);
	}
	
	function TagSearchView(containerNode, sitePanel, experience, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experience, inputNode, helpNode);
	}
	
	return TagSearchView;
})();

/* Displays site or organization */
var OrganizationSearchView = (function() {
	OrganizationSearchView.prototype = new ExperienceDatumSearchView();
	
	OrganizationSearchView.prototype.clearFromOrganization = function()
	{
		if (this.experience.organization)
		{
			if (this.experience.offering)
			{
				this.experience.clearOffering();
				this.experience.clearSite();
				this.experience.clearOrganization();
			}
			else if (this.experience.site)
			{
				this.experience.clearSite();
				this.experience.clearOrganization();
			}
			else
			{
				this.experience.clearOrganization();
			}
		}
		else
		{
			this.experience.clearOrganization();
		}
	}
	
	OrganizationSearchView.prototype.searchPath = function(val)
	{
		var path;
		if (val)
		{
			if (this.typeName === "Site from Organization")
			{
				path = 'Organization[_name{0}"{1}"]>Sites>Site::not(Site[_name{0}"{1}"])';
			}
			else if (this.typeName === "Site")
			{
				path = 'Site[_name{0}"{1}"]';
			}
			else if (this.typeName === "Organization")
			{
				path = 'Organization[_name{0}"{1}"]';
			}
			var symbol = "*=";
		
			return path.format(symbol, val);
		}
		else
			return '';
	}
	
	OrganizationSearchView.prototype.setupSearchTypes = function(searchText)
	{
		if (searchText)
		{
			this.typeNames = ["Organization", "Site from Organization", "Site", ];
		}
		else
		{
			this.typeNames = [""];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
	}
	
	OrganizationSearchView.prototype.checkHelp = function(showHelp)
	{
		var helpDiv = d3.select(this.helpNode);

		if (showHelp == (helpDiv.style('display') == 'block'))
			return false;
			
		if (showHelp)
		{
			var texts = [{styles: '', text: 'The name of the organization that is providing this experience.'},
						 ];
			helpDiv.selectAll('p')
				.data(texts)
				.enter()
				.append('p')
				.classed('list', function(d) { return d.styles == 'list'; })
				.text(function(d) { return d.text; });
			helpDiv.style('display', 'block');
		}
		else
		{
			helpDiv.selectAll('p').remove();
			helpDiv.style('display', 'none');
		}
		return true;
	}
	
	OrganizationSearchView.prototype.appendDescriptions = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text", true);
				if (d.typeName === "Site")
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
						leftText.text(d.getDescription());
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
				else
				{
					leftText.text(d.getDescription());
				}
			});
	}
	
	OrganizationSearchView.prototype.isDirtyText = function()
	{
		return this.inputText() != this.experience.organizationName;
	}
	
	function OrganizationSearchView(containerNode, sitePanel, experience, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experience, inputNode, helpNode);
	}
	
	return OrganizationSearchView;
})();

/* Displays organization, site, offering */
var SiteSearchView = (function() {
	SiteSearchView.prototype = new ExperienceDatumSearchView();
	
	SiteSearchView.prototype.clearFromSite = function()
	{
		if (this.experience.site)
		{
			if (this.experience.offering)
			{
				this.experience.clearOffering();
				this.experience.clearSite();
			}
			else
			{
				this.experience.clearSite();
			}
		}
		else
		{
			this.experience.clearSite();
		}
	}
	
	SiteSearchView.prototype.searchPath = function(val)
	{
		var path;
		if (this.experience.organizationName)
		{
			if (this.experience.organization == null)
			{
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
			
				var symbol = "*=";
			
				return path.format(symbol, val);
			}
		}
		else if (this.experience.services.length > 0)
		{
			if (!val)
			{
				return "";
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
			

				var symbol = "*=";
			
				return path.format(symbol, val);
			}
		}
		else 
		if (val)
		{
			if (this.typeName === "Site from Organization")
			{
				path = 'Organization[_name{0}"{1}"]>Sites>Site::not(Site[_name{0}"{1}"])';
			}
			else if (this.typeName === "Site")
			{
				path = 'Site[_name{0}"{1}"]';
			}
			else if (this.typeName === "Organization")
			{
				path = 'Organization[_name{0}"{1}"]';
			}
			var symbol = "*=";
		
			return path.format(symbol, val);
		}
		else
			return '';
	}
	
	SiteSearchView.prototype.setupSearchTypes = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experience.organizationName)
		{
			if (this.experience.organization)
			{
				if (searchText && searchText.length > 0)
					this.typeNames = ["Site", "Offering from Site", "Offering"];
				else
					this.typeNames = ["Site", "Offering from Site"];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experience.services.length > 0)
		{
			if (this.experience.services[0].pickedObject)
			{
				if (searchText && searchText.length > 0)
					this.typeNames = ["Offering from Site", "Offering", "Site", "Organization", "Site from Organization"];
				else
					this.typeNames = [""];
			}
			else
				this.typeNames = ["Site", "Organization", "Site from Organization"];
		}
		else if (searchText)
		{
			this.typeNames = ["Site", "Organization", "Site from Organization"];
		}
		else
		{
			this.typeNames = [""];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
	}
	
	SiteSearchView.prototype.checkHelp = function(showHelp)
	{
		var helpDiv = d3.select(this.helpNode);

		if (showHelp == (helpDiv.style('display') == 'block'))
			return false;
			
		if (showHelp)
		{
			var texts = [{styles: '', text: 'Examples:'}, 
						 {styles: 'list', text: 'Blackstone Community Center\n'},
						 {styles: 'list', text: 'Esplanade Boat House'},
						 {styles: 'list', text: 'Jackson/Mann School'},
						 {styles: 'list', text: 'McLean Playground'},
						 {styles: 'list', text: '24 Beacon St., Boston, MA'},
						 ];
			helpDiv.selectAll('p')
				.data(texts)
				.enter()
				.append('p')
				.classed('list', function(d) { return d.styles == 'list'; })
				.text(function(d) { return d.text; });
			helpDiv.style('display', 'block');
		}
		else
		{
			helpDiv.selectAll('p').remove();
			helpDiv.style('display', 'none');
		}
		return true;
	}
	
	SiteSearchView.prototype.appendDescriptions = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text", true);
				if (d.typeName === "Offering")
				{
					leftText.append('div')
						.classed('title', true).text(d.getDescription());

					orgDiv = leftText.append('div').classed("organization", true);
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
						
					if (orgValue.getDescription() == d.getDescription() ||
						orgValue.getValueID() == (_this.experience.organization && _this.experience.organization.getValueID()))
					{
						leftText.text(d.getDescription());
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
				else
				{
					leftText.text(d.getDescription());
				}
			});
	}
	
	SiteSearchView.prototype.isDirtyText = function()
	{
		return this.inputText() != this.experience.siteName;
	}
	
	function SiteSearchView(containerNode, sitePanel, experience, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experience, inputNode, helpNode);
	}
	
	return SiteSearchView;
})();

/* Typenames can be "Offering" or "Offering from Site" or "Service". The return types can be Offerings. */
var OfferingSearchView = (function() {
	OfferingSearchView.prototype = new ExperienceDatumSearchView();
	
	OfferingSearchView.prototype.clearFromOffering = function()
	{
		this.experience.clearOffering();
	}
	
	OfferingSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d.typeName === 'Service')
		{
			if (prepareClick('click', 'service for offering: ' + d.getDescription()))
			{
				this.experience.setOffering({text: d.getDescription() });
				this.sitePanel.onExperienceUpdated();
				this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
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
				this.sitePanel.onExperienceUpdated();
				_this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		d3.event.preventDefault();
	}
	
	OfferingSearchView.prototype.searchPath = function(val)
	{
		var path;

		if (this.experience.siteName)
		{
			if (this.experience.site)
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						path = "#{0}>Offerings>Offering".format(this.experience.site.getValueID());
						return path;
					}
					else
						throw new Error('unrecognized typeName');
				}
				else
				{
					if (this.typeName === "Offering")
					{
						path = "#{0}>Offerings>Offering".format(this.experience.site.getValueID()) + '[_name{0}"{1}"]';
					}
					else
						throw new Error('unrecognized typeName');
			
					var symbol = "*=";
			
					return path.format(symbol, val);
				}
			}
			else if (val)
			{
				throw new Error("Unreachable code");
			}
			else
				return '';
		}
		else if (this.experience.organizationName)
		{
			if (this.experience.organization)
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						path = "#{0}>Sites>Site>Offerings>Offering".format(this.experience.organization.getValueID());
						path += this.experience.getOfferingConstraint();
						return path;
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
			
					var symbol = "*=";
			
					return path.format(symbol, val);
				}
			}
			else
			{
				throw new Error("Unreachable code");
			}
		}
		else if (this.experience.services.length > 0)
		{
			if (val)
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
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			

				var symbol = "*=";
			
				return path.format(symbol, val);
			}
			else
			{
				path = "Offering";
				path += this.experience.getOfferingConstraint();
				return path;
			}
		}
 		else if (val)
		{
			if (this.typeName === "Offering")
			{
				path = 'Offering[_name{0}"{1}"]' +
						this.experience.getOfferingConstraint();
			}
			else
				throw new Error("Unrecognized typeName: {0}".format(this.typeName));
				
			var symbol = "*=";
		
			return path.format(symbol, val);
		}
		else
			return '';
	}
	
	OfferingSearchView.prototype.setupSearchTypes = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experience.siteName)
		{
			if (this.experience.site)
			{
				this.typeNames = ["Offering"];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experience.organizationName)
		{
			if (this.experience.organization)
			{
				if (searchText)
					this.typeNames = ["Offering from Site", "Offering"];
				else if (this.experience.getOfferingConstraint())
					this.typeNames = ["Offering"];
				else
					this.typeNames = ["Service"];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experience.services.length > 0)
		{
			if (this.experience.services[0].pickedObject)
			{
				if (searchText)
					this.typeNames = ["Offering", "Offering from Site"];
				else
					this.typeNames = ["Offering"];
			}
			else
				this.typeNames = [""];
		}
		else if (searchText)
		{
			this.typeNames = ["Offering"];
		}
		else
		{
			this.typeNames = [""];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
	}
	
	OfferingSearchView.prototype.checkHelp = function(showHelp)
	{
		var helpDiv = d3.select(this.helpNode);

		if (showHelp == (helpDiv.style('display') == 'block'))
			return false;
			
		if (showHelp)
		{
			var texts = [{styles: '', text: 'The name of the program or service provided.'}, 
						 ];
			helpDiv.selectAll('p')
				.data(texts)
				.enter()
				.append('p')
				.classed('list', function(d) { return d.styles == 'list'; })
				.text(function(d) { return d.text; });
			helpDiv.style('display', 'block');
		}
		else
		{
			helpDiv.selectAll('p').remove();
			helpDiv.style('display', 'none');
		}
		return true;
	}
	
	OfferingSearchView.prototype.appendDescriptions = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text", true);
				if (d.typeName === "Offering")
				{
					if (_this.experience.site && _this.experience.site.getValueID() == d.getValue("Site").getValueID())
						leftText.text(d.getDescription());
					else
					{
						leftText.append('div')
							.classed('title', true).text(d.getDescription());
	
						orgDiv = leftText.append('div').classed("organization", true);
						if (d.getValue("Organization").getValueID() !=
							(_this.experience.organization && _this.experience.organization.getValueID()))
							orgDiv.append('div').text(d.getValue("Organization").getDescription());
						if (d.getValue("Site").getDescription() != d.getValue("Organization").getDescription())
						{
							orgDiv.append('div')
								.classed('address-line', true)
								.text(d.getValue("Site").getDescription());
						}
					}
				}
				else if (d.typeName === "Service")
				{
					leftText.text(d.getDescription());
				}
				else
				{
					leftText.text(d.getDescription());
				}
			});
	}
	
	OfferingSearchView.prototype.isDirtyText = function()
	{
		return this.inputText() != this.experience.offeringName;
	}
	
	function OfferingSearchView(containerNode, sitePanel, experience, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experience, inputNode, helpNode);
	}
	
	return OfferingSearchView;
})();

var VerticalReveal = (function() {
	VerticalReveal.prototype.node = null;

	VerticalReveal.prototype.isVisible = function()
	{
		return this._isVisible;
	}
	
	VerticalReveal.prototype.show = function(args, duration, step, done)
	{
		var jNode = $(this.node);

		if (!args)
			args = {};
		if (args.newHeight === undefined)
			args.newHeight = 'auto';
		if (args.children === undefined)
			args.children = jNode.children();

		args.children.css('display', '');
		this._isVisible = true;
		var oldHeight = jNode.height();
		jNode.height(args.newHeight);
		if (args.before)
			args.before();
			
		if (!duration)
		{
			if (step) step();
			if (done) done();
		}
		else if (args.newHeight == 'auto')
		{
			/* This hack smells bad, but it seems to work. The problem occurs in that the code
				below doesn't do the right thing if this item has padding on the bottom. (and maybe the top,
				but I didn't test that. */
			var outerHeight = jNode.outerHeight(false);
			jNode.height(oldHeight);
			jNode.animate({height: outerHeight}, {duration: duration, easing: 'swing', step: step, done: done});
			
		}
		else
		{
			var height = jNode.height();
			jNode.height(oldHeight);
			jNode.animate({height: height}, {duration: duration, easing: 'swing', step: step, done: done});
		}
	}
	
	VerticalReveal.prototype.hide = function(args)
	{
		var duration = (args && args.duration) ? args.duration : 0;
		var step = (args && args.step) ? args.step : null;
		var done = (args && args.done) ? args.done : null;
		var before = (args && args.before) ? args.before : null;
		
		var jNode = $(this.node);

		var oldHeight = jNode.height();
		jNode.height(0);
		if (before)
			before();
			
		if (!duration)
		{
			if (step) step();
			if (done) done();
			jNode.children().css('display', 'none');
			this._isVisible = false;
		}
		else
		{
			var _this = this;
			jNode.height(oldHeight);
			jNode.animate({height: "0px"}, {duration: duration, easing: 'swing', step: step, done: 
				function() {
					jNode.children().css('display', 'none');
					_this._isVisible = false;
					if (done) done();
				}});
		}
	}
			
	function VerticalReveal(node)
	{
		this.node = node;
		this._isVisible = true;
	}
	
	return VerticalReveal;
})();

/* This is the entry panel for the workflow. The experience contains no data on entry. 
	This panel can specify a search domain or, with typing, pick a service, offering, organization or site.
	One can also specify a custom service or a custom organization. */
var ConfirmDeleteAlert = (function () {

	function ConfirmDeleteAlert(panelNode, confirmText, done, cancel)
	{
		var dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		var confirmButton = div.append('button')
			.text(confirmText)
			.classed("text-danger", true)
			.on("click", function()
				{
					if (prepareClick('click', confirmText))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							done();
						});
						dimmer.hide();
					}
				});
				
		var onCancel = function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						panel.remove();
						cancel();
					});
					dimmer.hide();
				}
			}
			
		div.append('button')
			.text("Cancel")
			.on("click", onCancel);
		
		dimmer.show();
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		$(confirmButton.node()).on('blur', function()
			{
				if (prepareClick('blur', confirmText))
				{
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						panel.remove();
						cancel();
					});
				}
			});
			
		dimmer.mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ConfirmDeleteAlert;
})();

var ExperienceShareOptions = (function () {

	function ExperienceShareOptions(panelNode, experience, path)
	{
		var dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		function onCancel(e)
		{
			if (prepareClick('click', 'Cancel'))
			{
				$(emailAddExperienceButton.node()).off('blur');
				$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
					panel.remove();
					unblockClick();
				});
				dimmer.hide();
			}
			e.preventDefault();
		}
		
		if (cr.signedinUser)
		{
			var duplicateText = (path == cr.signedinUser.getValue("More Experiences")) ? "Duplicate Experience" : "Add to My Pathway";
		
			var addToMyPathwayButton = div.append('button')
				.text(duplicateText)
				.classed("site-active-text", true)
				.on("click", function()
					{
						if (prepareClick('click', duplicateText))
						{
							var tempExperience = new Experience(cr.signedinUser.getValue("More Experiences"), experience);
							var newPanel = new NewExperiencePanel(tempExperience, panel.node(), tempExperience.getPhase());
							showPanelUp(newPanel.node())
								.done(function()
									{
										$(emailAddExperienceButton.node()).off('blur');
										panel.remove();
										dimmer.remove();
									})
								.always(unblockClick);
						}
					});
				
			$(addToMyPathwayButton.node()).on('blur', onCancel);
		}
		
		var emailAddExperienceButton = div.append('button')
			.text("Email Add Experience Link")
			.classed("site-active-text", true)
			.on("click", function()
				{
					if (prepareClick('click', "Email Add Experience Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							window.location = 'mailto:?subject=Add%20Pathway%20Experience&body=Here is a link to add an experience to your pathway: {0}/add/{1}/.'
										.format(window.location.origin, experience.getValueID());
							unblockClick();
						});
						dimmer.hide();
					}
				});
				
		$(emailAddExperienceButton.node()).on('blur', onCancel);
		
		var cancelButton = div.append('button')
			.text("Cancel")
			.classed("site-active-text", true);
		
		$(cancelButton.node()).click(onCancel);
		
		dimmer.show();
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(emailAddExperienceButton.node()).focus();
				unblockClick();
			}});
		dimmer.mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ExperienceShareOptions;
})();

var NewExperiencePanel = (function () {
	NewExperiencePanel.prototype = new SitePanel();
	NewExperiencePanel.prototype.allServices = null;
	
	NewExperiencePanel.prototype.organizationSearchView = null;
	NewExperiencePanel.prototype.siteSearchView = null;
	NewExperiencePanel.prototype.offeringSearchView = null;
	NewExperiencePanel.prototype.tagsSection = null;
	NewExperiencePanel.prototype.tagSearchView = null;
	NewExperiencePanel.prototype.startHidable = null;
	NewExperiencePanel.prototype.endHidable = null;

	NewExperiencePanel.prototype.title = "New Experience";
	NewExperiencePanel.prototype.editTitle = "Edit Experience";
	NewExperiencePanel.prototype.newFromDomainTitle = "New {0} Experience";
	NewExperiencePanel.prototype.previousExperienceLabel = "Done";
	NewExperiencePanel.prototype.currentExperienceLabel = "Doing Now";
	NewExperiencePanel.prototype.goalLabel = "Goal";
	NewExperiencePanel.prototype.nameOrTagRequiredMessage = 'Your experience needs at least a name or a tag.';
	
	NewExperiencePanel.prototype.appendHidableDateInput = function(dateContainer, minDate, maxDate)
	{
		var _this = this;
		var itemsDiv = dateContainer.append('ol')
			.classed('item', true);
		var itemDiv = itemsDiv.append('li');
		var dateInput = itemDiv.append('span');
		var hidableDiv = new HidableDiv(dateInput.node());
		var dateWheel = new DateWheel(dateContainer.node(), function(newDate)
			{
				dateInput.text(getLocaleDateString(newDate));
				$(dateInput.node()).width('auto');
				hidableDiv.width = $(dateInput.node()).width();
			}, minDate, maxDate);

		var reveal = new VerticalReveal(dateWheel.node());
		reveal.hide();
		
		dateInput.on('click', function()
			{
				if (!reveal.isVisible())
				{
					try
					{
						var done = function()
						{
							dateInput.classed('site-active-text', true);
							reveal.show({}, 200, undefined, function()
								{
									dateWheel.restoreDate();
								});
						}
						if (!_this.onFocusInOtherInput(reveal, done))
						{
							done();
						}
					}
					catch (err)
					{
						cr.asyncFail(err);
					}
				}
				else
				{
					hideWheel();
				}
			});
		
		var hidingChevron = new HidingChevron(itemDiv, 
			function()
			{
				dateWheel.unclear();
				dateWheel.showDate(dateWheel.value());
				hidableDiv.show(function()
					{
						unblockClick();
					});
				notSureReveal.show({}, 200,
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
							hideWheel();
							hideValue(unblockClick);
							notSureReveal.hide({duration: 200,
											    step: function()
													{
														_this.calculateHeight();
													}
												});
						}
					});
		notSureSpan.append('div').text('Not Sure');
		var notSureReveal = new VerticalReveal(notSureSpan.node());
		
		var hideValue = function(done)
		{
			hidableDiv.hide(function()
			{
				hidingChevron.show(function()
					{
						dateWheel.clear();
						if (done)
							done();
					});
			});
		}
			
		var hideWheel = function(done)
		{
			dateInput.classed('site-active-text', false);
			reveal.hide({duration: 200,
						 before: done});
		}
		
		var showWheel = function(done)
		{
			dateInput.classed('site-active-text', true);
			reveal.show({done: done});
		}
		
		/* Calculate layout-based variables after css is complete. */
		setTimeout(function()
			{
				hidingChevron.height(hidableDiv.height());
			}, 0);
		
		return {dateInput: dateWheel, hidableDiv: hidableDiv, 
		    wheelReveal: reveal,
			notSureReveal: notSureReveal,
			hideValue: hideValue,
			hideWheel: hideWheel,
			showWheel: showWheel,
		};
	}
	
	NewExperiencePanel.prototype.getInputTextWidth = function(inputNode)
	{
		var div = document.createElement('span');
		$(div).addClass('textWidth')
			.text(inputNode.value || $(inputNode).attr('placeholder'));
		$(inputNode).parent().append(div);
		var width = $(div).outerWidth();
		$(div).remove();
		return width;
	}
	
	NewExperiencePanel.prototype.appendTag = function(container, instance)
	{
		var input = container.insert('input', 'input:last-of-type')
			.datum(instance)
			.classed('tag', true)
			.attr('placeholder', instance ? 'Tag' : 'New Tag')
			.attr('value', instance && instance.getDescription());
			
		$(input.node()).on('click', function(e)
			{
				this.setSelectionRange(0, this.value.length);
				e.preventDefault();
			});
		
		var _this = this;	
		setTimeout(function()
			{
				var newWidth = _this.getInputTextWidth(input.node()) + 18;
				$(input.node()).outerWidth(newWidth);
			});
		
		$(input.node()).on('input', function()
			{
				/* Check for text changes for all input boxes. The primary input box is handled
					in the constructor of the ExperienceDatumSearchView class. */
				if (this != _this.tagInput.node())
					_this.tagSearchView.constrainFoundObjects(this);
				$(this).outerWidth(_this.getInputTextWidth(this) + 18);
			});
		
		$(input.node()).on('focusin', function()
			{
				_this.tagSearchView.focusNode = this;
				_this.onFocusInTagInput(this);
			});
			
		if (!instance)
		{
			$(input.node()).keydown( function(event) {
				if(event.keyCode == 9) {
					event.preventDefault();
				}
  			});
		}

		return input;
	}
	
	NewExperiencePanel.prototype.showTags = function()
	{
		var offeringTags = [];
		var tags = [];
		
		var offering = this.experience.offering;
		if (offering && offering.getValueID())
		{
			offeringTags = offering.getCell("Service").data
				.filter(function(v) { return !v.isEmpty(); });
		}
		
		var container = this.mainDiv.select('span.offering-tags-container');
		container.selectAll('span').remove();
		container.selectAll('span')
			.data(offeringTags)
			.enter()
			.append('span')
			.classed('tag', true)
			.text(function(d) { return d.getDescription(); });
			
		var container = this.mainDiv.select('.tags-container');
		var tagDivs = container.selectAll('input.tag');
		tags = tags.concat(this.experience.services.filter(function(v) 
			{ 
				return !offeringTags.find(function(d)
					{
						return d.getDescription() === v.getDescription();
					}) &&
					!tags.find(function(d) 
					{ 
						return d.getDescription() === v.getDescription(); 
					})
			}));
		
		tagDivs.filter(function(d) { return d != null && tags.indexOf(d) < 0; } ).remove();
		
		var ds = tagDivs.data();
		for (var i = 0; i < tags.length; ++i)
		{
			if (ds.indexOf(tags[i]) < 0)
			{
				this.appendTag(container, tags[i]);
			}
		}
	}
	
	NewExperiencePanel.prototype.updateInputs = function()
	{
		this.organizationInput.node().value = this.experience.organizationName;
		this.siteInput.node().value = this.experience.siteName;
		this.offeringInput.node().value = this.experience.offeringName;
		this.showTags();
	}

	NewExperiencePanel.prototype.onExperienceUpdated = function()
	{
		this.updateInputs();
		this.calculateHeight();
	}
	
	NewExperiencePanel.prototype.getTagConstrainText = function()
	{
		var tagsContainer = this.mainDiv.select('.tags-container');
		var inputs = tagsContainer.selectAll('input:focus');
		if (inputs.size() > 0)
			return inputs.node().value.trim();
		else
			return "";
	}
	
	NewExperiencePanel.prototype.checkOrganizationInput = function()
	{
		var newText = this.organizationSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.organizationSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.getValueID() != (this.experience.organization && this.experience.organization.getValueID()))
				this.experience.setOrganization({instance: newInstance});
			else if (newText != this.experience.organizationName)
				this.experience.setOrganization({text: newText});
		}
		else
			this.organizationSearchView.clearFromOrganization();
		this.updateInputs();
	}
		
	NewExperiencePanel.prototype.checkSiteInput = function()
	{
		var newText = this.siteSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.siteSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.getValueID() != (this.experience.site && this.experience.site.getValueID()))
				this.experience.setSite({instance: newInstance});
			else if (newText != this.experience.siteName)
				this.experience.setSite({text: newText});
		}
		else
			this.siteSearchView.clearFromSite();
		this.updateInputs();
	}
		
	NewExperiencePanel.prototype.checkOfferingInput = function()
	{
		var newText = this.offeringSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.offeringSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.getValueID() != (this.experience.offering && this.experience.offering.getValueID()))
				this.experience.setOffering({instance: newInstance});
			else if (newText != this.experience.offeringName)
				this.experience.setOffering({text: newText});
		}
		else
		{
			this.offeringSearchView.clearFromOffering();
		}
		this.updateInputs();
	}
	
	NewExperiencePanel.prototype.checkTagInput = function(exceptNode)
	{
		var tagsContainer = this.mainDiv.select('.tags-container');
		var _this = this;
		tagsContainer.selectAll('input.tag').each(function(d, i)
			{
				/* Skip the exceptNode */
				if (this == exceptNode)
					return;
					
				if (d && d.constructor == ReportedObject)
				{
					var newText = this.value.trim();
					if (!newText)
					{
						_this.experience.removeService(d);
						$(this).remove();
					}
					else
					{
						var newInstance = _this.tagSearchView.hasNamedButton(newText.toLocaleLowerCase());
						if (!newInstance)
						{
							if (newText != d.name)
							{
								d.pickedObject = null;
								d.name = newText;
								this.value = d.getDescription();	/* Reset the value in case there was trimming */
								$(this).trigger('input');
							}
						}
						else if (newInstance != d.instance)
						{
							d.pickedObject = newInstance;
							d.name = newInstance.getDescription();
							this.value = d.getDescription();
							$(this).trigger('input');
						}
					}
				}
				else
				{
					var newText = this.value.trim();
					if (newText)
					{
						var d = _this.tagSearchView.hasNamedButton(newText.toLocaleLowerCase());
						if (d)
							_this.experience.addService({instance: d});
						else
							_this.experience.addService({text: newText});
						_this.showTags();
						this.value = "";
					}
				}
			});
	}
	
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	NewExperiencePanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.organizationSearchView.reveal &&
			this.organizationSearchView.reveal.isVisible())
		{
			this.checkOrganizationInput();
			this.organizationSearchView.hideSearch(done);
			return true;
		}
		else if (newReveal != this.siteSearchView.reveal &&
			this.siteSearchView.reveal.isVisible())
		{
			this.checkSiteInput();
			this.siteSearchView.hideSearch(done);
			return true;
		}
		else if (newReveal != this.offeringSearchView.reveal &&
			this.offeringSearchView.reveal.isVisible())
		{
			this.checkOfferingInput();
			this.offeringSearchView.hideSearch(done);
			return true;
		}
		else if (newReveal != this.tagSearchView.reveal &&
			this.tagSearchView.reveal.isVisible())
		{
			this.checkTagInput();
			this.tagSearchView.hideSearch(done);
			return true;
		}
		else if (newReveal != this.startHidable.wheelReveal &&
			this.startHidable.wheelReveal.isVisible())
		{
			this.startHidable.hideWheel(done);
			return true;
		}
		else if (newReveal != this.endHidable.wheelReveal &&
			this.endHidable.wheelReveal.isVisible())
		{
			this.endHidable.hideWheel(done);
			return true;
		}
		else
			return false;
	}
	
	NewExperiencePanel.prototype.onFocusInTagInput = function(inputNode)
	{
		var _this = this;
		var done = function()
				{
					_this.tagSearchView.constrainFoundObjects(inputNode);
					_this.tagSearchView.showSearch(200, undefined, function()
						{
							var oldTop = $(_this.tagsSection.node()).offset().top;
							if (oldTop < $(window).scrollTop())
							{
								var body = $("html, body");
								body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
							}
						});
				};
		if (!this.onFocusInOtherInput(_this.tagSearchView.reveal, done))
		{
			this.checkTagInput(inputNode);
			this.tagSearchView.constrainFoundObjects(inputNode);
			if (!this.tagSearchView.reveal.isVisible())
			{
				this.tagSearchView.showSearch();
			}
		}
	}
	
	NewExperiencePanel.prototype.resizeVisibleSearch = function(duration)
	{
		/* This may be called before tagSearchView is initialized. */
		if (this.tagSearchView && this.tagSearchView.reveal.isVisible())
		{
			this.tagSearchView.showSearch(duration);
		}
		else if (this.organizationSearchView.reveal.isVisible())
		{
			this.organizationSearchView.showSearch(duration);
		}
		else if (this.siteSearchView.reveal.isVisible())
		{
			this.siteSearchView.showSearch(duration);
		}
		else if (this.offeringSearchView.reveal.isVisible())
		{
			this.offeringSearchView.showSearch(duration);
		}
	}

	NewExperiencePanel.prototype.handleDeleteButtonClick = function()
	{
		if (prepareClick('click', 'delete experience'))
		{
			var _this = this;
			new ConfirmDeleteAlert(this.node(), "Delete Experience", 
				function() { 
					_this.experience.instance.deleteValue(
						function() { _this.hidePanelDown(unblockClick) },
						cr.syncFail);
				}, 
				function() { 
					unblockClick();
				});
		}
	}
	
	function NewExperiencePanel(experience, previousPanelNode, phase) {
		if (experience.instance)
			this.title = this.editTitle;
		else if (experience.domain)
			this.title = this.newFromDomainTitle.format(experience.domain.getDescription());
		else if (experience.stage)
			this.title = this.newFromDomainTitle.format(experience.stage.getDescription());
		else if (experience.serviceDomain)
			this.title = this.newFromDomainTitle.format(experience.serviceDomain.getDescription());
			
			
		SitePanel.call(this, previousPanelNode, null, this.title, "edit experience new-experience-panel", revealPanelUp);
	
		var hidePanel = function() { 
				_this.hide();
			}
		var _this = this;
		this.experience = experience;
		
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
						try
						{
							experience.startDate = _this.startHidable.hidableDiv.isVisible() ? startDateInput.value() : null;
							experience.endDate = _this.endHidable.hidableDiv.isVisible() ? endDateInput.value() : null;
							if (experience.startDate && experience.endDate)
							{
								experience.timeframe = undefined;
								experience.add(hidePanel);
							}
							else
							{
								$.when(crp.promise({path: "_term[_name=Timeframe]>enumerator"}))
								 .then(function(enumerators)
								     {
								     	var timeframeName;
								     	
										if (previousExperienceButton.classed('pressed'))
											timeframeName = "Previous";
										else if (currentExperienceButton.classed('pressed'))
											timeframeName = "Current";
										else
											timeframeName = "Goal";
										experience.timeframe = enumerators.find(function(d)
											{
												return d.getDescription() == timeframeName;
											});

										experience.add(hidePanel);
								     },
								     function(err)
								     {
								     	throw err;
								     });
							}
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
				}
				
				if (_this.organizationSearchView.isDirtyText())
				{
					_this.checkOrganizationInput();
				}
				if (_this.siteSearchView.isDirtyText())
				{
					_this.checkSiteInput();
				}
				if (_this.offeringSearchView.isDirtyText())
				{
					_this.checkOfferingInput();
				}
				
				_this.checkTagInput();
						
				if (!experience.offeringName &&
					experience.services.length == 0)
					asyncFailFunction(_this.nameOrTagRequiredMessage);
				else
				{
					doAdd();
				}
				d3.event.preventDefault();
			});
		nextButton.append("span").text(experience.instance ? "Done" : "Add");
		
		navContainer.appendTitle(this.title);
		
		var panel2Div = this.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		if (experience.instance)
		{
			var bottomNavContainer = this.appendBottomNavContainer();
			bottomNavContainer.appendRightButton()
				.on("click", 
					function() {
						_this.handleDeleteButtonClick();
					})
				.append("span").classed("text-danger", true).text("Delete");
			
			var shareButton = bottomNavContainer.appendLeftButton()
				.classed("share", true)
				.on('click', function()
					{
						if (prepareClick('click', 'share'))
						{
							new ExperienceShareOptions(_this.node(), experience.instance, experience.instance.cell.parent);
						}
					});
			shareButton.append("img")
				.attr("src", shareImagePath);
		}

		var section;
		var label;
		var searchContainer;
				
		section = panel2Div.append('section')
			.classed('cell unique organization', true);
				
		this.organizationInput = section.append('input')
			.classed('organization', true)
			.attr('placeholder', 'Organization (Optional)')
			.attr('value', experience.organizationName);
		organizationHelp = section.append('div')
			.classed('help', true);
			
		searchContainer = section.append('div');
			
		this.organizationSearchView = new OrganizationSearchView(searchContainer.node(), 
																 this, experience, 
																 this.organizationInput.node(), 
																 organizationHelp.node());
		
		section = panel2Div.append('section')
			.classed('cell unique site', true);
				
		this.siteInput = section.append('input')
			.classed('site', true)
			.attr('placeholder', 'Location (Optional)')
			.attr('value', experience.siteName);
		siteHelp = section.append('div').classed('help', true);
		
		searchContainer = section.append('div');
			
		this.siteSearchView = new SiteSearchView(searchContainer.node(), 
												 this, experience, 
												 this.siteInput.node(), 
												 siteHelp.node());
		
		section = panel2Div.append('section')
			.classed('cell unique offering', true);
				
		this.offeringInput = section.append('input')
			.classed('offering', true)
			.attr('placeholder', 'Title')
			.attr('value', experience.offeringName);
		offeringHelp = section.append('div').classed('help', true);
			
		searchContainer = section.append('div');
			
		this.offeringSearchView = new OfferingSearchView(searchContainer.node(), 
														 this, experience, 
														 this.offeringInput.node(), 
														 offeringHelp.node());
		
		this.tagsSection = panel2Div.append('section')
			.classed('cell tags', true);
		label = this.tagsSection.append('label')
			.text('Tags:');
		
		/* Put the officeTagsContains and the tagsContainer within the label so that,
			when they word wrap, then do so rationally.
		 */
		var officeTagsContainer = label.append('span')
			.classed('offering-tags-container', true);
		
		var tagsContainer = label.append('span')
			.classed('tags-container', true);
		
		this.tagInput = this.appendTag(tagsContainer, null);
		
		tagHelp = tagsContainer.append('div').classed('help', true);
			
		searchContainer = this.tagsSection.append('div');
		
		this.tagSearchView = new TagSearchView(searchContainer.node(), 
												this, experience, 
												this.tagInput.node(), 
												tagHelp.node());
												
		crp.promise({path: "Service"})
			.done(function(newInstances)
				{
					_this.allServices = newInstances;
					_this.tagSearchView.showObjects(newInstances);
				})
			.fail(cr.syncFail);
		
		$(panel2Div.node()).on('resize.cr', function()
		{
			_this.resizeVisibleSearch(0);
		});

		var birthday = experience.path.getDatum("Birthday") ||
			(function()
			 {
				var todayDate = getUTCTodayDate();
				return "{0}-{1}".format(todayDate.getUTCFullYear() - 100, todayDate.getUTCMonth() + 1);
			 })();
		
		var optionPanel = panel2Div.append('section')
			.classed('date-range-options', true);

		var previousExperienceButton = optionPanel.append('button')
			.classed('previous', true)
			.on('click', function()
				{
					currentExperienceButton.classed('pressed', false);
					goalButton.classed('pressed', false);
					previousExperienceButton.classed('pressed', true);
					
					startDateInput.checkMinDate(new Date(birthday), getUTCTodayDate());
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
					
					startDateInput.checkMinDate(new Date(birthday), getUTCTodayDate());
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
					
					setGoalStartDateRange();
					$(startDateInput).trigger('change');
				})
			.text(this.goalLabel);
			
		var startDateContainer = panel2Div.append('section')
			.classed('cell unique date-container', true);

		startDateContainer.append('label')
			.text("Start");
		this.startHidable = this.appendHidableDateInput(startDateContainer, new Date(birthday));
		var startDateInput = this.startHidable.dateInput;
		
		$(startDateInput).on('change', function() {
			var minEndDate, maxEndDate;
			var dateWheelValue = this.value();
			if (previousExperienceButton.classed('pressed'))
			{
				if (dateWheelValue && dateWheelValue.length > 0)
					minEndDate = new Date(dateWheelValue);
				else if (birthday)
					minEndDate = new Date(birthday);
				else
					minEndDate = getUTCTodayDate();
			}
			else if (currentExperienceButton.classed('pressed'))
			{
				minEndDate = getUTCTodayDate();
			}
			else
			{
				if (dateWheelValue && dateWheelValue.length > 0)
					minEndDate = new Date(dateWheelValue);
				else
					minEndDate = getUTCTodayDate();
			}
			
			if (previousExperienceButton.classed('pressed'))
			{
				maxEndDate = getUTCTodayDate();
			}
			else
			{
				maxEndDate = getUTCTodayDate();
				maxEndDate.setUTCFullYear(maxEndDate.getUTCFullYear() + 50);
			}
				
			endDateInput.checkMinDate(minEndDate, maxEndDate);
		});
		
		var endDateContainer = panel2Div.append('section')
			.classed('cell unique date-container', true);
		var endLabel = endDateContainer.append('label')
			.text("End");
			
		this.endHidable = this.appendHidableDateInput(endDateContainer, new Date(birthday));
		var endDateInput = this.endHidable.dateInput;
		
		if (experience.startDate)
			this.startHidable.notSureReveal.show();
		else
			this.startHidable.notSureReveal.hide();
		if (experience.endDate)
			this.endHidable.notSureReveal.show();
		else
			this.endHidable.notSureReveal.hide();
		
		if (experience.startDate)
			startDateInput.value(experience.startDate);
		else
		{
			setTimeout(function()
				{
					_this.startHidable.hideValue();
				});
		}
			
		if (experience.endDate)
			endDateInput.value(experience.endDate);
		else
		{
			setTimeout(function()
				{
					_this.endHidable.hideValue();
				});
		}
		
		this.showTags();
		
		function setGoalStartDateRange()
		{
			var startMinDate = getUTCTodayDate();
			var startMaxDate = new Date(startMinDate);
			startMaxDate.setUTCFullYear(startMaxDate.getUTCFullYear() + 50);
			startDateInput.checkMinDate(startMinDate, startMaxDate);
		}
		
		setTimeout(function()
			{
				if (!experience.instance)
				{
					if (!experience.organizationName)
						_this.organizationInput.node().focus();
					else if (!experience.siteName)
						_this.siteInput.node().focus();
					else if (!experience.offeringName)
						_this.offeringInput.node().focus();
				}

				if (phase == 'Current')
				{
					startDateInput.onChange();
					currentExperienceButton.classed('pressed', true);
					startDateInput.checkMinDate(new Date(birthday), getUTCTodayDate());
				}
				else if (phase == 'Goal')
				{
					goalButton.classed('pressed', true);
					setGoalStartDateRange();
				}
				else
				{
					startDateInput.onChange();
					endDateInput.onChange();
					previousExperienceButton.classed('pressed', true);
					startDateInput.checkMinDate(new Date(birthday), getUTCTodayDate());
				}
				$(startDateInput).trigger('change');
			});

		$(this.organizationInput.node()).on('focusin', function()
			{
				var done = function()
						{
							_this.organizationSearchView.restartSearchTimeout();
							_this.organizationSearchView.showSearch(200, undefined, function()
								{
									var oldTop = $(_this.organizationInput.node()).offset().top;
									if (oldTop < $(window).scrollTop())
									{
										var body = $("html, body");
										body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
									}
								});
						};
				if (!_this.onFocusInOtherInput(_this.organizationSearchView.reveal, done))
				{
					if (!_this.organizationSearchView.reveal.isVisible())
						done();
				}
			});
			
		$(this.siteInput.node()).on('focusin', function()
			{
				var done = function()
						{
							_this.siteSearchView.restartSearchTimeout();
							_this.siteSearchView.showSearch(200, undefined, function()
								{
									var oldTop = $(_this.siteInput.node()).offset().top;
									if (oldTop < $(window).scrollTop())
									{
										var body = $("html, body");
										body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
									}
								});
						}
				if (!_this.onFocusInOtherInput(_this.siteSearchView.reveal, done))
				{
					if (!_this.siteSearchView.reveal.isVisible())
						done();
				}
			});
		
		$(this.offeringInput.node()).on('focusin', function()
			{
				var done = function()
						{
							_this.offeringSearchView.restartSearchTimeout();
							_this.offeringSearchView.showSearch(200, undefined, function()
								{
									var oldTop = $(_this.offeringInput.node()).offset().top;
									if (oldTop < $(window).scrollTop())
									{
										var body = $("html, body");
										body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
									}
								});
						};
				if (!_this.onFocusInOtherInput(_this.offeringSearchView.reveal, done))
				{
					if (!_this.offeringSearchView.reveal.isVisible())
						done();
				}
			});
	}
	
	return NewExperiencePanel;
})();

