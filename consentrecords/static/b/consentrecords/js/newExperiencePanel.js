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
			if (d && d.getTypeName() != "Service")
				throw new Error("Invalid instance to addService");
				
			service = new ReportedObject({name: newName, pickedObject: d});
			if (newName.length > 0)
			{
				this.services.push(service);
			}
		}
		else if ("instance" in args && args.instance)
		{
			if (args.instance.getTypeName() != "Service")
				throw new Error("Invalid instance to addService");
				
			var d = args.instance;
			var service = new ReportedObject({pickedObject: d})
			this.services.push(service);
		}
		else
			throw new Error("Invalid arguments to addService");
			
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
			initialData["Organization"] = [{instanceID: this.organization.getInstanceID()}];
		else if (this.organizationName)
			initialData["User Entered Organization"] = [{text: this.organizationName}];
			
		if (this.site)
			initialData["Site"] = [{instanceID: this.site.getInstanceID()}];
		else if (this.siteName)
			initialData["User Entered Site"] = [{text: this.siteName}];
			
		if (this.offering)
			initialData["Offering"] = [{instanceID: this.offering.getInstanceID()}];
		else if (this.offeringName)
			initialData["User Entered Offering"] = [{text: this.offeringName}];
		
		var existingServices = null;
		if (this.offering && this.offering.getCell("Service"))
			existingServices = this.offering.getCell("Service").data;
			
		if (this.timeframe)
			initialData["Timeframe"] = [{instanceID: this.timeframe.getInstanceID()}];
				
		for (i = 0; i < this.services.length; ++i)
		{
			var s = this.services[i];
			
			/* Make sure the service isn't part of the offering's services. */
			if (s.pickedObject)
			{
				if (!existingServices || 
					!existingServices.find(function(d) { 
						return s.pickedObject.getInstanceID() == d.getInstanceID(); 
					}))
				{
					if (!initialData["Service"])
						initialData["Service"] = [{instanceID: s.pickedObject.getInstanceID()}];
					else
						initialData["Service"].push({instanceID: s.pickedObject.getInstanceID()});
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
		
		initialData["Comments"] = [{cells:
				{
					"Comment": []
				}}
			];
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
		if (offering && offering.getInstanceID())
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
		if (offering && offering.getInstanceID())
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
	
	Experience.prototype.add = function()
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
					.map(function(d) { return d.getInstanceID(); });

			var newServices = this.services.filter(function(s) {
					return s.pickedObject &&
						(!existingServices || 
					     !existingServices.find(function(d) { 
							return s.pickedObject.getInstanceID() == d;
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
			
			return cr.updateValues(updateData, sourceObjects)
				.then(function()
					{
						var offering = _this.instance.getValue("Offering");
						if (offering && offering.getInstanceID() && !offering.areCellsLoaded())
							return offering.promiseCellsFromCache();
						else
							return undefined;
					});
		}
		else
		{
			/* Test case: add an experience to a path. */
			bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

			field = {ofKind: "More Experience", name: "More Experience"};
			var initialData = {};

			this.appendData(initialData);
		
			return cr.createInstance(field, this.path.getInstanceID(), initialData)
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
					})
			 .then(function(newData)
			 		{
			 			_this.path.getCell("More Experience").addValue(newData);
			 		});
		}
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
		this.endDate = "";
	}
	
	Experience.prototype.initGoalDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.startDate = "";
		this.endDate = "";
	}
	
	Experience.prototype.initDateRange = function(phase)
	{
		if (phase === 'Goal')
			this.initGoalDateRange();
		else if (phase === 'Current')
			this.initCurrentDateRange();
		else
			this.initPreviousDateRange();
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
				panel = new NewExperiencePanel(this);
			}
			else
			{
				panel = new NewExperiencePanel(this);
			}
		}
		else
		{
			panel = new NewExperiencePanel(this);
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
			
		var panel = new NewExperiencePanel(this);
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
			
		var panel = new NewExperiencePanel(this);
		done(panel.node());
	}
	
	Experience.prototype.createFromService = function(d, previousNode, done)
	{
		this.initPreviousDateRange();
		
		var service = this.addService(d);
		var panel = new NewExperiencePanel(this);
		done(panel.node());
	}
	
	Experience.prototype.getOfferingConstraint = function()
	{
		if (this.services.length > 0 &&
			this.services[0].pickedObject)
			return '[Service[Service={0}]]'.format(this.services[0].pickedObject.getInstanceID());
		else if (this.domain)
			return '[Service[Service={0}]]'.format(this.domain.getInstanceID());
		else if (this.stage)
			return '[Service[Stage={0}]]'.format(this.stage.getInstanceID());
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
		if (t && t.getInstanceID())
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
		return source.toLocaleLowerCase().search(new RegExp("\\b{0}".format(RegExp.escape(target)))) >= 0;
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

/* A reported object combines a name and a ModelObject that might be picked. */
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
    		return v2.pickedObject && v2.pickedObject.getInstanceID() == this.pickedObject.getInstanceID();
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
	
	ExperienceDatumSearchView.prototype.minRevealHeight = 100;	/* pixels */

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
		if (d.getTypeName() === 'Service')
		{
			if (prepareClick('click', 'service: ' + d.getDescription()))
			{
				if (!this.experience.offeringName &&
					this.experience.services.find(function(d2)
						{
							return d2.pickedObject && d2.pickedObject.getInstanceID() == d.getInstanceID();
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
		else if (d.getTypeName() === 'Organization')
		{
			if (prepareClick('click', 'organization: ' + d.getDescription()))
			{
				try
				{
					/* Clear the site and offering if they aren't within the new organization. */
					if (_this.experience.site &&
						_this.experience.organization &&
						_this.experience.organization.getInstanceID() != d.getInstanceID())
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
		else if (d.getTypeName() === 'Site')
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
									_this.experience.site.getInstanceID() != d.getInstanceID())
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
		else if (d.getTypeName() === 'Offering')
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
				return d.getTypeName() === "Site" &&
					   d.getDescription() === compareText &&
					   d.getValue("Organization").getDescription() === compareText;
			});
	}
	
	ExperienceDatumSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		/* Do not display organizations if there is a site with the same name. */
		if (d.getTypeName() === "Organization" &&
			this.hasUniqueSite(d))
			return false;
		
		if (this.isMatchingDatum(d, compareText))
			return true;

		if (d.getTypeName() === "Offering")
		{
			if (this.stringContains(d.getValue("Site").getDescription(), compareText))
				return true;
			if (this.stringContains(d.getValue("Organization").getDescription(), compareText))
				return true;
		}
		else if (d.getTypeName() === "Site")
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
		else
			/* Clear away any previously found items. */
			this.cancelSearch();
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
		if (this.minRevealHeight > newHeight)
			newHeight = this.minRevealHeight;
			
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
	TagSearchView.prototype = new TagPoolView();
	
	TagSearchView.prototype.reveal = null;
	TagSearchView.prototype.focusNode = null;
	TagSearchView.prototype.sitePanel = null;
	TagSearchView.prototype.inputBox = null;
	TagSearchView.prototype.experience = null;
	
	TagSearchView.prototype.minRevealedHeight = 118;
	
	TagSearchView.prototype.onTagAdded = function()
	{
	}
	
	TagSearchView.prototype.hideSearch = function(done)
	{
		this.reveal.hide({duration: 200,
						  before: done});
	}
	
	/* Expand this object view so that it fills as much of the window as possible without
		scrolling other elements off screen.
	 */
	TagSearchView.prototype.showSearch = function(duration, step, done)
	{
		duration = duration !== undefined ? duration : 400;
		var parent = $(this.reveal.node).parent();
		var oldHeight = $(this.reveal.node).height();
		$(this.reveal.node).height(0);
		var newHeight = parent.getFillHeight() - 
						parent.outerHeight(true);

		if (this.minRevealedHeight > newHeight)
			newHeight = this.minRevealedHeight;
			
		$(this.reveal.node).height(oldHeight);
		var _this = this;
		if (oldHeight != newHeight)
		{
			this.reveal.show(
				/* To calculate the new height, get the fill height of the parent (the height of its parent minus the height of all other nodes)
					and subtract the parent's height and add back the reveal node's height. */
				{newHeight: newHeight,
				 before: function()
				 	{
				 		_this.layoutFlags();
				 	}},
				duration, step, done);
		}
		else
			this.layoutFlags();
	}
	
	TagSearchView.prototype.firstTagInputNode = function()
	{
		return this.sitePanel.mainDiv.select('.tags-container>input.tag').node();
	}
	
	/* Set the visible flags for each of the services associated with this flags. */
	TagSearchView.prototype.setFlagVisibles = function()
	{
		if (this.focusNode.value ||
			this.focusNode != this.firstTagInputNode() ||
			(this.experience.offering &&
			  this.experience.offering.getCell("Service").data.length > 0))
			TagPoolView.prototype.setFlagVisibles.call(this);
		else
		{
			var types = ["Job", 
						 "School",
						 "Class", 
						 "Interest", 
						 "Skills", 
						 "Internship", 
						 "Volunteer", 
						 "Exercise", 
						 "Housing"];
			this.flags().each(function(fs)
				{
					fs.visible = (types.indexOf(fs.getDescription()) < 0 ? false : undefined);
				});
		}
	}

	TagSearchView.prototype.constrainTagFlags = function()
	{
		this.filterFlags(this.focusNode.value);
		this.layoutFlags();
	}
	
	TagSearchView.prototype.hasSubService = function(service)
	{
		serviceID = service.getInstanceID();
		
		return this.sitePanel.allServices.find(function(s)
			{
				if (s.getInstanceID() == serviceID)
					return false;
				return s.getCell("Service").data.find(function(subS)
					{
						return subS.getInstanceID() == serviceID;
					});
			});
	}
	
	TagSearchView.prototype.onClickButton = function(d) {
		if (prepareClick('click', 'service: ' + d.getDescription()))
		{
			try
			{
				var d3Focus = d3.select(this.focusNode);
				var moveToNewInput = !this.hasSubService(d.service);
				var newDatum;
				
				if (d3Focus.datum())
				{
					newDatum = d3Focus.datum();
					if (newDatum.pickedObject == d.service)
						moveToNewInput = true;
					else
					{
						newDatum.name = d.getDescription();
						newDatum.pickedObject = d.service;
						this.focusNode.value = d.getDescription();
					}
					
				}
				else
				{
					newDatum = this.experience.addService({instance: d.service});
				}
				
				/* If the user clicks a flag that is the same as the flag already there, then move on. 
					If the user clicks a flag that has no sub-flags other than itself, then move on.
					Otherwise, stay there.
				 */			 
				this.sitePanel.onExperienceUpdated();
				this.inputBox.value = "";
				$(this.inputBox).trigger('input');
				if (moveToNewInput)
					this.inputBox.focus();
				else
				{
					d3.select(this.focusNode.parentNode)
						.selectAll('input.tag')
						.filter(function(d) { return d == newDatum; })
						.node().focus();
				}
				unblockClick();
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}

		d3.event.preventDefault();
	}
	
	function TagSearchView(container, sitePanel, experience, tagInput)
	{
		TagPoolView.call(this, container, 'pool-container');
		
		this.sitePanel = sitePanel;
		this.experience = experience;
		this.inputBox = tagInput.node();
		this.tagInput = tagInput;
		
		this.reveal = new VerticalReveal(container.node());
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
				if (d.getTypeName() === "Site")
				{
					/* The organization name is either a value of d or, if d is a value
					   of an Offering, then the organization name is the value of the offering.
					 */
					var orgValue;
					if (d.cell && d.cell.parent && d.cell.parent.getTypeName() === "Offering")
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
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experience.organizationName || "");
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
					return "#{0}>Sites>Site".format(this.experience.organization.getInstanceID());
				else if (this.typeName === "Offering from Site")
				{
					path = "#{0}>Sites>Site>Offerings>Offering".format(this.experience.organization.getInstanceID());
					path += this.experience.getOfferingConstraint();
					return path;
				}
			}
			else
			{
				if (this.typeName === "Offering")
				{
					path = 'Offering[_name{0}"{1}"]::not(Site[_name{0}"{1}"]>Offerings>Offering)';
					path = "#{0}>Sites>Site>Offerings>".format(this.experience.organization.getInstanceID()) + path;
					path += this.experience.getOfferingConstraint();
				}
				else if (this.typeName === "Offering from Site")
				{
					path = 'Site[_name{0}"{1}"]>Offerings>Offering';
					path = "#{0}>Sites>".format(this.experience.organization.getInstanceID()) + path;
					path += this.experience.getOfferingConstraint();
				}
				else if (this.typeName === "Site")
				{
					path = 'Site[_name{0}"{1}"]';
					path = "#{0}>Sites>".format(this.experience.organization.getInstanceID()) + path;
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
						path += '[Offerings>Offering[Service={0}]]'.format(this.experience.services[0].pickedObject.getInstanceID());
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
				if (d.getTypeName() === "Offering")
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
				else if (d.getTypeName() === "Site")
				{
					/* The organization name is either a value of d or, if d is a value
					   of an Offering, then the organization name is the value of the offering.
					 */
					var orgValue;
					if (d.cell && d.cell.parent && d.cell.parent.getTypeName() === "Offering")
						orgValue = d.cell.parent.getValue("Organization");
					else
						orgValue = d.getValue("Organization");
						
					if (orgValue.getDescription() == d.getDescription() ||
						orgValue.getInstanceID() == (_this.experience.organization && _this.experience.organization.getInstanceID()))
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
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experience.siteName || "");
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
		if (d.getTypeName() === 'Service')
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
		else if (d.getTypeName() === 'Offering')
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
						path = "#{0}>Offerings>Offering".format(this.experience.site.getInstanceID());
						return path;
					}
					else
						throw new Error('unrecognized typeName');
				}
				else
				{
					if (this.typeName === "Offering")
					{
						path = "#{0}>Offerings>Offering".format(this.experience.site.getInstanceID()) + '[_name{0}"{1}"]';
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
						path = "#{0}>Sites>Site>Offerings>Offering".format(this.experience.organization.getInstanceID());
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
						path = "#{0}>Sites>Site>Offerings>".format(this.experience.organization.getInstanceID()) + path;
						path += this.experience.getOfferingConstraint();
					}
					else if (this.typeName === "Offering from Site")
					{
						path = 'Site[_name{0}"{1}"]>Offerings>Offering';
						path = "#{0}>Sites>".format(this.experience.organization.getInstanceID()) + path;
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
				if (d.getTypeName() === "Offering")
				{
					if (_this.experience.site && _this.experience.site.getInstanceID() == d.getValue("Site").getInstanceID())
						leftText.text(d.getDescription());
					else
					{
						leftText.append('div')
							.classed('title', true).text(d.getDescription());
	
						orgDiv = leftText.append('div').classed("organization", true);
						if (d.getValue("Organization").getInstanceID() !=
							(_this.experience.organization && _this.experience.organization.getInstanceID()))
							orgDiv.append('div').text(d.getValue("Organization").getDescription());
						if (d.getValue("Site").getDescription() != d.getValue("Organization").getDescription())
						{
							orgDiv.append('div')
								.classed('address-line', true)
								.text(d.getValue("Site").getDescription());
						}
					}
				}
				else if (d.getTypeName() === "Service")
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
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experience.offeringName || "");
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
			var duplicateText = (path == cr.signedinUser.subInstance("Path")) ? "Duplicate Experience" : "Add to My Pathway";
		
			var addToMyPathwayButton = div.append('button')
				.text(duplicateText)
				.classed("site-active-text", true)
				.on("click", function()
					{
						if (prepareClick('click', duplicateText))
						{
							var tempExperience = new Experience(cr.signedinUser.getValue("Path"), experience);
							var newPanel = new NewExperiencePanel(tempExperience, tempExperience.getPhase());
							newPanel.showUp()
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
			.text("Mail Add Experience Link")
			.classed("site-active-text", true)
			.on("click", function()
				{
					if (prepareClick('click', "Mail Add Experience Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							window.location = 'mailto:?subject=Add%20Pathway%20Experience&body=Here is a link to add an experience to your pathway: {0}/add/{1}/.'
										.format(window.location.origin, experience.getInstanceID());
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
	
	/* A function called when the panel is dismissed successfully. */
	NewExperiencePanel.prototype.done = null;

	NewExperiencePanel.prototype.title = "New Experience";
	NewExperiencePanel.prototype.editTitle = "Edit Experience";
	NewExperiencePanel.prototype.newFromDomainTitle = "New {0} Experience";
	NewExperiencePanel.prototype.timeframeLabel = "This experience is...";
	NewExperiencePanel.prototype.previousExperienceLabel = "Done";
	NewExperiencePanel.prototype.currentExperienceLabel = "Something I'm Doing Now";
	NewExperiencePanel.prototype.goalLabel = "My Goal";
	NewExperiencePanel.prototype.nameOrTagRequiredMessage = 'Your experience needs at least a name or a tag.';
	NewExperiencePanel.prototype.firstTagHelp = 'What type of experience is this?';
	NewExperiencePanel.prototype.otherTagHelp = 'What other tag goes with this experience?';
	NewExperiencePanel.prototype.organizationDefaultPlaceholder = 'Organization (Optional)';
	NewExperiencePanel.prototype.siteDefaultPlaceholder = 'Location (Optional)';
	NewExperiencePanel.prototype.offeringDefaultPlaceholder = 'Title';
	
	NewExperiencePanel.prototype.appendHidableDateInput = function(dateContainer, minDate, maxDate)
	{
		var _this = this;
		var itemsDiv = dateContainer.append('ol')
			.classed('item', true);
		var itemDiv = itemsDiv.append('li');
		var dateSpan = itemDiv.append('span');
		var dateWheel = new DateWheel(dateContainer.node(), function(newDate)
			{
				if (newDate)
					dateSpan.text(getLocaleDateString(newDate));
				else
					dateSpan.text("Not Sure");
			}, minDate, maxDate);

		var reveal = new VerticalReveal(dateWheel.node());
		reveal.hide();
		
		dateSpan.on('click', function()
			{
				if (!reveal.isVisible())
				{
					try
					{
						var done = function()
						{
							dateSpan.classed('site-active-text', true);
							reveal.show({}, 200, undefined, function()
								{
									dateWheel.onShowing();
								});
							notSureReveal.show({duration: 200});
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
		
		var notSureButton = dateContainer.append('div')
				.classed('in-cell-button site-active-text', true)
				.on('click', function()
					{
						if (prepareClick('click', "Not Sure"))
						{
							hideWheel();
							dateWheel.clear();
							dateSpan.text("Not Sure");
							unblockClick();
						}
					});
		notSureButton.append('div').text('Not Sure');
		var notSureReveal = new VerticalReveal(notSureButton.node());
		notSureReveal.hide();
			
		var hideWheel = function(done)
		{
			dateSpan.classed('site-active-text', false);
			dateWheel.onHiding();
			reveal.hide({duration: 200,
						 before: function()
						 	{
						 		notSureReveal.hide({duration: 200,  before: done});
						 	}});
		}
		
		var showWheel = function(done)
		{
			dateSpan.classed('site-active-text', true);
			reveal.show({}, 200, undefined,
				function()
				{
					notSureReveal.show({done: done});
				});
			
		}
		
		return {dateWheel: dateWheel, 
		    wheelReveal: reveal,
			notSureReveal: notSureReveal,
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
	
	NewExperiencePanel.prototype.setTagColor = function(node)
	{
		if (node == document.activeElement)
		{
			d3.select(node)
				.style('background-color', null)
				.style('border-color', null)
				.style('color', null);
		}
		else
		{
			var pathGuide;
			var d = d3.select(node).datum();
			var service = null;
			
			if (d)
			{
				if (d.constructor == cr.ModelObject)
					service = d;	/* This occurs for tags associated with offerings. */
				else if (d.constructor == ReportedObject)
					service = d.pickedObject;
			}
			
			if (service)
			{
				var s = new Service(service);
				pathGuide = PathGuides.data[s.getColumn()];
			}
			else
				pathGuide = PathGuides.data[PathGuides.data.length - 1];
		
			d3.select(node)
				.style('background-color', pathGuide.flagColor)
				.style('border-color', pathGuide.poleColor)
				.style('color', pathGuide.fontColor);
		}
	}
	
	NewExperiencePanel.prototype.setTagInputWidth = function(inputNode)
	{
		var newWidth = this.getInputTextWidth(inputNode) + 18;
		$(inputNode).outerWidth(newWidth);
		
		this.setTagColor(inputNode);
		
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
		
		$(input.node()).on('input', function()
			{
				/* Check for text changes for all input boxes.  */
				if (this == _this.tagSearchView.focusNode)
				{
					_this.tagSearchView.constrainTagFlags();
				}
				_this.setTagInputWidth(this);
			})
			.on('focusin', function()
			{
				_this.tagSearchView.focusNode = this;
				_this.onFocusInTagInput(this);
			})
			.on('focusout', function()
			{
				_this.setTagInputWidth(this);
				_this.setPlaceholders();
			})
			.keypress(function(e) {
				if (e.which == 13)
				{
					_this.checkTagInput();
					e.preventDefault();
				}
			})
			.keydown( function(event) {
				if (event.keyCode == 9) {
					/* If this is an empty node with no instance to remove, then don't handle here. */
					if (!input.node().value && !instance)
						return;
					/* If this is a node whose value matches the previous value, then don't handle here. */
					else if (instance && input.node().value == instance.getDescription())
						return;
					else if (instance && input.node().value != instance.getDescription())
					{
						_this.checkTagInput();
						/* Do not prevent default. */
					}
					else
					{
						_this.checkTagInput();
						_this.tagSearchView.constrainTagFlags();
						event.preventDefault();
					}
				}
			});

		return input;
	}
	
	NewExperiencePanel.prototype.showTags = function()
	{
		var offeringTags = [];
		var tags = [];
		var _this = this;
		
		var offering = this.experience.offering;
		if (offering && offering.getInstanceID())
		{
			offeringTags = offering.getCell("Service").data
				.filter(function(v) { return !v.isEmpty(); });
		}
		
		var container = this.mainDiv.select('span.offering-tags-container');
		container.selectAll('span').remove();
		var parent = $(container.node().parentNode.parentNode);
		if (offeringTags.length > 0)
		{
			container.selectAll('span')
				.data(offeringTags)
				.enter()
				.append('span')
				.classed('tag', true)
				.text(function(d) { return d.getDescription(); })
				.each(function()
					{
						_this.setTagColor(this);
					});
			parent.css('display', 'block');
		}
		else
		{
			parent.css('display', 'none');
		}
			
		container = this.mainDiv.select('.tags-container');
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
			var input;
			if (ds.indexOf(tags[i]) < 0)
			{
				input = this.appendTag(container, tags[i]);
			}
			else
			{
				input = tagDivs.filter(function(d) { return d == tags[i]; });
				input.node().value = tags[i].getDescription();
			}
			this.setTagInputWidth(input.node());
		}
	}
	
	NewExperiencePanel.prototype._serviceLabel = function(service, cellName)
	{
		if (!service)
			return "";
			
		var label = service.getDatum(cellName);
		if (label)
			return label;
			
		var subObj = service.getCell("Service").data.find(function(s)
			{
				return s.getDatum(cellName);
			});
		return subObj && subObj.getDatum(cellName);
	}
	
	NewExperiencePanel.prototype.setPlaceholders = function()
	{
		var service = this.experience.services.find(function(s)
			{
				return s.pickedObject &&
					   new Service(s.pickedObject).getColumn() < PathGuides.data.length - 1;
			});
			
		this.organizationInput
			.attr('placeholder', 
				  (service && this._serviceLabel(service.pickedObject, 'Organization Label')) || this.organizationDefaultPlaceholder);
		this.siteInput
			.attr('placeholder', 
				  (service && this._serviceLabel(service.pickedObject, 'Site Label')) || this.siteDefaultPlaceholder);
		this.offeringInput
			.attr('placeholder', 
				  (service && this._serviceLabel(service.pickedObject, 'Offering Label')) || this.offeringDefaultPlaceholder);
	}
	
	NewExperiencePanel.prototype.updateInputs = function()
	{
		/* Reset the placeholders to ensure that they are properly displayed or hidden given
			the changes in the values. This fixes a bug on MacOS Safari.
		 */
		this.organizationInput.attr('placeholder', null);
		this.siteInput.attr('placeholder', null);
		this.offeringInput.attr('placeholder', null);
		
		this.organizationInput.node().value = this.experience.organizationName;
		this.siteInput.node().value = this.experience.siteName;
		this.offeringInput.node().value = this.experience.offeringName;

		this.showTags();
		this.setPlaceholders();
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
				newInstance.getInstanceID() != (this.experience.organization && this.experience.organization.getInstanceID()))
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
				newInstance.getInstanceID() != (this.experience.site && this.experience.site.getInstanceID()))
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
				newInstance.getInstanceID() != (this.experience.offering && this.experience.offering.getInstanceID()))
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
						var newInstance = _this.tagSearchView.hasNamedService(newText.toLocaleLowerCase());
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
						else if (newInstance != d.pickedObject)
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
						var d = _this.tagSearchView.hasNamedService(newText.toLocaleLowerCase());
						if (d)
							_this.experience.addService({instance: d});
						else
							_this.experience.addService({text: newText});
						_this.showTags();
						this.value = "";
						$(this).attr('placeholder', $(this).attr('placeholder'));
					}
				}
			});
			
		this.setPlaceholders();
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
	
	NewExperiencePanel.prototype.setTagHelp = function()
	{
		if (this.tagSearchView.focusNode == this.tagSearchView.firstTagInputNode() &&
			(!this.experience.offering ||
			  this.experience.offering.getCell("Service").data.length == 0))
			this.tagHelp.text(this.firstTagHelp);
		else
			this.tagHelp.text(this.otherTagHelp);
	}
	
	NewExperiencePanel.prototype.onFocusInTagInput = function(inputNode)
	{
		var _this = this;
		d3.select(inputNode)
			.style('background-color', null)
			.style('border-color', null)
			.style('color', null);
			
		var done = function()
				{
					_this.setTagHelp();
					_this.tagSearchView.constrainTagFlags();
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
			this.setTagHelp();
			this.tagSearchView.constrainTagFlags();
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
		/* Test case: Delete an experience. */
		if (prepareClick('click', 'delete experience'))
		{
			var _this = this;
			new ConfirmDeleteAlert(this.node(), "Delete Experience", 
				function() { 
					_this.experience.instance.deleteValue(
						function() { _this.hideDown(unblockClick) },
						cr.syncFail);
				}, 
				function() { 
					unblockClick();
				});
		}
	}
	
	function NewExperiencePanel(experience, phase, showFunction) {
		if (experience.title)
			this.title = experience.title;
		else if (experience.instance)
			this.title = this.editTitle;
		else if (experience.domain)
			this.title = this.newFromDomainTitle.format(experience.domain.getDescription());
		else if (experience.stage)
			this.title = this.newFromDomainTitle.format(experience.stage.getDescription());
		else if (experience.serviceDomain)
			this.title = this.newFromDomainTitle.format(experience.serviceDomain.getDescription());
			
		showFunction = showFunction !== undefined ? showFunction : revealPanelUp;
			
		this.createRoot(null, this.title, "edit experience new-experience-panel", showFunction);
		
		var hidePanel = function() { 
				_this.hide()
					.then(function() {					
						if (_this.done)
							_this.done();
					});
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
		
		if (experience.instance)
		{
			var shareButton = navContainer.appendRightButton()
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
		
		navContainer.appendTitle(this.title);
		
		var panel2Div = this.appendScrollArea();
		
		var bottomNavContainer = this.appendBottomNavContainer();
		var doneButton = bottomNavContainer.appendRightButton()
			.classed("site-active-text", true)
			.classed("default-link", true)
			.on("click", function()
			{
				function doAdd()
				{
					if (prepareClick('click', 'NewExperiencePanel: {0}'.format(doneButton.select("span").text())))
					{
						try
						{
							experience.startDate = startDateWheel.value() != '' ? startDateWheel.value() : null;
							experience.endDate = endDateWheel.value() != '' ? endDateWheel.value() : null;
							if (experience.startDate && experience.endDate)
							{
								experience.timeframe = undefined;
								experience.add()
									.then(hidePanel, cr.syncFail);
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

										experience.add()
											.then(hidePanel, cr.syncFail);
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
		doneButton.append("span").text(experience.instance ? "Done" : "Add");
		
		if (experience.instance)
		{
			bottomNavContainer.appendLeftButton()
				.on("click", 
					function() {
						_this.handleDeleteButtonClick();
					})
				.append("span").classed("text-danger", true).text("Delete");
		}

		var section;
		var label;
		var searchContainer;
		
		section = panel2Div.append('section');
		
		/* The tags section. */
		this.tagsSection = panel2Div.append('section')
			.classed('cell tags custom', true);
		var tagsTopContainer = this.tagsSection.append('div');
		label = tagsTopContainer.append('label')
			.text('Tags:');
		
		var tagsContainer = tagsTopContainer.append('span')
			.classed('tags-container', true);
		
		this.tagInput = this.appendTag(tagsContainer, null);
		
		searchContainer = this.tagsSection.append('div');
		
		this.tagHelp = searchContainer.append('div').classed('tag-help', true);
		this.tagHelp.text(this.firstTagHelp);
			
		this.tagSearchView = new TagSearchView(searchContainer, this, experience, this.tagInput);
												
		/* Code starting for the date range. */
		var birthday = experience.path.getDatum("Birthday") ||
			(function()
			 {
				var todayDate = getUTCTodayDate();
				return "{0}-{1}".format(todayDate.getUTCFullYear() - 100, todayDate.getUTCMonth() + 1);
			 })();
		
		var optionPanel = panel2Div.append('section')
			.classed('date-range-options', true);
		
		optionPanel.append('div')
			.text(this.timeframeLabel);

		var buttonDiv = optionPanel.append('div');
		var previousExperienceButton = buttonDiv.append('button')
			.classed('previous', true)
			.on('click', function()
				{
					currentExperienceButton.classed('pressed', false);
					goalButton.classed('pressed', false);
					previousExperienceButton.classed('pressed', true);
					
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
					$(startDateWheel).trigger('change');
					setDateRangeLabels();
				})
			.text(this.previousExperienceLabel);
		
		var currentExperienceButton = buttonDiv.append('button')
			.classed('present', true)
			.on('click', function()
				{
					goalButton.classed('pressed', false);
					previousExperienceButton.classed('pressed', false);
					currentExperienceButton.classed('pressed', true);
					
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
					$(startDateWheel).trigger('change');
					setDateRangeLabels();
				})
			.text(this.currentExperienceLabel);
		
		var goalButton = buttonDiv.append('button')
			.classed('goal', true)
			.on('click', function()
				{
					previousExperienceButton.classed('pressed', false);
					currentExperienceButton.classed('pressed', false);
					goalButton.classed('pressed', true);
					
					setGoalStartDateRange();
					$(startDateWheel).trigger('change');
					setDateRangeLabels();
				})
			.text(this.goalLabel);
			
		function setDateRangeLabels()
		{
			startDateContainer.select('label')
						.text(goalButton.classed('pressed') ? 'Starts' : 'Started');
			endDateContainer.select('label')
						.text(previousExperienceButton.classed('pressed') ? 'Ended' : 'Ends');
		}
			
		var startDateContainer = panel2Div.append('section')
			.classed('cell unique date-container', true);

		startDateContainer.append('label')
			.text("Start");
		this.startHidable = this.appendHidableDateInput(startDateContainer, new Date(birthday));
		var startDateWheel = this.startHidable.dateWheel;
		
		$(startDateWheel).on('change', function() {
			var minEndDate, maxEndDate;
			var dateWheelValue = this.value() != '' ? this.value() : null;
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
				
			endDateWheel.checkMinDate(minEndDate, maxEndDate);
			$(endDateWheel).trigger('change');
		});
		
		var endDateContainer = panel2Div.append('section')
			.classed('cell unique date-container', true);
		var endLabel = endDateContainer.append('label')
			.text("End");
			
		this.endHidable = this.appendHidableDateInput(endDateContainer, new Date(birthday));
		var endDateWheel = this.endHidable.dateWheel;
		
		if (experience.startDate)
			startDateWheel.value(experience.startDate);
		else
		{
			if (experience.endDate)
			{
				/* Initialize the start date to a reasonable value, not the current date. */
				var startGuessDate = new Date(experience.endDate);
				startGuessDate.setUTCFullYear(startGuessDate.getUTCFullYear() - 1);
				var startGuessDateString = startGuessDate.toISOString().substring(0, 7);
				if (startGuessDateString < birthday)
					startDateWheel.value(birthday);
				else
					startDateWheel.value(startGuessDateString);
			}
			startDateWheel.clear();
		}
			
		if (experience.endDate)
			endDateWheel.value(experience.endDate);
		else
		{
			if (experience.startDate)
			{
				/* Initialize the end date to a reasonable value. */
				var guessDate = new Date(experience.startDate);
				guessDate.setUTCFullYear(guessDate.getUTCFullYear() + 1);
				var guessDateString = guessDate.toISOString().substring(0, 7);
				endDateWheel.value(guessDateString);
			}
			endDateWheel.clear();
		}
				
		/* The organization section. */
		section = panel2Div.append('section')
			.classed('cell unique organization', true);
				
		this.organizationInput = section.append('input')
			.classed('organization', true)
			.attr('placeholder', this.organizationDefaultPlaceholder)
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
			.attr('placeholder', this.siteDefaultPlaceholder)
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
			.attr('placeholder', this.offeringDefaultPlaceholder)
			.attr('value', experience.offeringName);
		offeringHelp = section.append('div').classed('help', true);
			
		searchContainer = section.append('div');
			
		this.offeringSearchView = new OfferingSearchView(searchContainer.node(), 
														 this, experience, 
														 this.offeringInput.node(), 
														 offeringHelp.node());
		
		/* The offering tags section. */
		tagsTopContainer = panel2Div.append('section')
			.classed('cell tags offering', true)
			.append('div');
		label = tagsTopContainer.append('label')
			.append('span')
			.text('Offering Tags:');
		
		tagsTopContainer.append('span')
			.classed('offering-tags-container', true);
		
		function setGoalStartDateRange()
		{
			var startMinDate = getUTCTodayDate();
			var startMaxDate = new Date(startMinDate);
			startMaxDate.setUTCFullYear(startMaxDate.getUTCFullYear() + 50);
			startDateWheel.checkMinDate(startMinDate, startMaxDate);
		}
		
		$(this.node()).one("revealing.cr", function()
			{
				_this.setTagInputWidth(_this.tagInput.node());

				_this.showTags();
				
				if (phase == 'Current')
				{
					startDateWheel.onChange();
					currentExperienceButton.classed('pressed', true);
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
				}
				else if (phase == 'Goal')
				{
					goalButton.classed('pressed', true);
					setGoalStartDateRange();
				}
				else
				{
					startDateWheel.onChange();
					endDateWheel.onChange();
					previousExperienceButton.classed('pressed', true);
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
				}
				$(startDateWheel).trigger('change');
				setDateRangeLabels();
			});

		crp.promise({path: "Service"})
			.then(function(newInstances)
				{
					_this.allServices = newInstances;
					var services = newInstances.map(function(s) { return new Service(s); });
					_this.tagSearchView.appendFlags(services)
						.on('click', function(s)
							{
								if (s.visible === undefined || s.visible)
									_this.tagSearchView.onClickButton(s);
								else
									d3.event.preventDefault();
							});
					
					/* Have to hide after appending the flags or the metrics aren't calculated. */
					_this.tagSearchView.reveal.hide();
				
					_this.tagSearchView.inputBox.focus();
				},
				cr.syncFail);
		
		$(panel2Div.node()).on('resize.cr', function()
		{
			_this.resizeVisibleSearch(0);
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

