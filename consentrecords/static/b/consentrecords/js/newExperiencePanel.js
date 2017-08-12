var ExperienceController = (function() {	
	/* The path containing the object to which to add the experience. */
	ExperienceController.prototype.path = null;
	
	/* The instance is an instance to be replaced. */
	ExperienceController.prototype.instance = null;
	ExperienceController.prototype.newExperience = null;
	
	ExperienceController.prototype._domain = null;
	ExperienceController.prototype._stage = null;
	ExperienceController.prototype._title = null;
	
	ExperienceController.prototype.domain = function(newValue)
	{
		if (newValue === undefined)
			return this._domain;
		else
		{
		    if (newValue != this._domain)
		    {
				this._domain = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.stage = function(newValue)
	{
		if (newValue === undefined)
			return this._stage;
		else
		{
		    if (newValue != this._stage)
		    {
				this._stage = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.title = function(newValue)
	{
		if (newValue === undefined)
			return this._title;
		else
		{
		    if (newValue != this._title)
		    {
				this._title = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.organizationName = function()
	{
		return this.newExperience.organizationName();
	}

	ExperienceController.prototype.siteName = function()
	{
		return this.newExperience.siteName();
	}

	ExperienceController.prototype.offeringName = function()
	{
		return this.newExperience.offeringName();
	}

	ExperienceController.prototype.organization = function(newValue)
	{
		var value = this.newExperience.organization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOrganization = function(newValue)
	{
		var value = this.newExperience.customOrganization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.site = function(newValue)
	{
		var value = this.newExperience.site(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customSite = function(newValue)
	{
		var value = this.newExperience.customSite(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.offering = function(newValue)
	{
		var value = this.newExperience.offering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOffering = function(newValue)
	{
		var value = this.newExperience.customOffering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.experienceServices = function(newValue)
	{
		var value = this.newExperience.experienceServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customServices = function(newValue)
	{
		var value = this.newExperience.customServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.start = function(newValue)
	{
		var value = this.newExperience.start(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.end = function(newValue)
	{
		var value = this.newExperience.end(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.timeframe = function(newValue)
	{
		var value = this.newExperience.timeframe(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.clearOrganization = function()
	{
		this.newExperience.organization(null)
						  .site(null)
						  .customOrganization(null)
						  .customSite(null);
		return this;
	}
	
	ExperienceController.prototype.clearSite = function()
	{
		this.newExperience.site(null)
						  .customSite(null);
		return this;
	}
	
	ExperienceController.prototype.organizationPicked = function(d)
	{
		if (this.site() &&
			this.organization() &&
			this.organization().id() != d.id())
		{
			if (this.offering())
			{
				this.clearOffering();
				this.clearSite();
			}
			else
			{
				this.clearSite();
			}
		}
		
		this.newExperience.organization(d)
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.sitePicked = function(d)
	{
		if (this.offering() &&
			this.site() &&
			this.site().id() != d.id())
			this.clearOffering();
			
		this.newExperience.site(d)
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.offeringPicked = function(d)
	{
		console.assert(d.site());
		console.assert(d.organization());
		
		this.newExperience.offering(d)
						  .customOffering(null)
						  .site(d.site())
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.clearOffering = function()
	{
		this.newExperience.offering(null)
						  .customOffering(null);
		return this;
	}
	
	/* Args can either be a cr.Service or a string. */
	ExperienceController.prototype.addService = function(args)
	{
		if (args instanceof cr.Service)
		{
			var i = new cr.ExperienceService();
			i.description(args.description())
			 .parentID(this.newExperience.id())
			 .service(args);
			this.experienceServices().push(i);
			return i;
		}
		else if (typeof(args) == "string")
		{
			var i = new cr.ExperienceCustomService();
			i.description(args)
			 .parentID(this.newExperience.id())
			 .name(args);
			this.customServices().push(i);
			return i;
		}
		else
			throw new Error("Invalid arguments to addService");
	}
	
	ExperienceController.prototype.removeService = function(service)
	{
		cr.removeElement(this.newExperience.experienceServices(), service);
	}
	
	ExperienceController.prototype.removeCustomService = function(service)
	{
		cr.removeElement(this.newExperience.customServices(), service);
	}
	
	ExperienceController.prototype.distinctExperienceServices = function()
	{
		var existingServices = null;
		if (this.offering() && this.offering().offeringServices())
			existingServices = this.offering().offeringServices()
				.map(function(os) { return os.service(); });
		
		return this.newExperience.experienceServices().filter(
			function(s)
				{
					return !existingServices || 
						   !existingServices.find(function(d) { 
							return s.service().id() == d.id(); 
						});
				});	
	}
	
	ExperienceController.prototype.appendData = function(initialData, idPrefix)
	{
		if (this.start())
			initialData['start'] = this.start();
		if (this.end())
			initialData['end'] = this.end();
		
		if (this.organization())
			initialData['organization'] = this.organization().urlPath();
		else if (this.customOrganization())
			initialData['custom organization'] = this.customOrganization();
			
		if (this.site())
			initialData['site'] = this.site().urlPath();
		else if (this.customSite())
			initialData['custom site'] = this.customSite();
			
		if (this.offering())
			initialData['offering'] = this.offering().urlPath();
		else if (this.customOffering())
			initialData['custom offering'] = this.customOffering();
		
		if (this.timeframe())
			initialData['timeframe'] = this.timeframe();
		
		var i = 0;
		
		var newServices = this.distinctExperienceServices()
			.map(function(s)
				{
					var addID = '{0}.{1}'.format(idPrefix, i);
					s.clientID(addID);
					return {add: addID, position: i++, service: s.service().urlPath()};
				});
		if (newServices.length)
		{
			initialData['services'] = newServices
		}
		
		i = 0;
		var newCustomServices = this.customServices()
			.map(function(s)
				{
					var addID = '{0}.cs.{1}'.format(idPrefix, i);
					s.clientID(addID);
					return {position: i, name: s};
				});
	}
	
	ExperienceController.prototype.getServiceByName = function(name)
	{
		for (i = 0; i < this.experienceServices().length; ++i)
		{
			if (this.experienceServices()[i].description() == name)
				return this.experienceServices()[i].service();
		}
		return null;
	}
	
	ExperienceController.prototype.getTagList = function()
	{
		return this.newExperience.getTagList();
	}
	
	ExperienceController.prototype.appendTags = function(container, tagDivs, addFunction)
	{
		tagDivs = tagDivs !== undefined ? tagDivs : container.selectAll('span');
		addFunction = addFunction !== undefined ? addFunction : function(container, instance)
			{
				container.append('span')
					.datum(instance)
					.classed('tag', true)
					.text(instance.description());
			};
			
		var tags = [];
		
		var offering = this.offering;
		if (offering && offering.id())
		{
			names = offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(os) { return os.service(); });
			tags = tags.concat(names);
		}

		tags = tags.concat(this.experienceServices.filter(function(es) 
			{
				var esDescription = es.description();
				return !tags.find(function(d) 
					{ 
						return d.description() === esDescription; 
					})
			})
			.map(function(es) { return es.service(); })
			);
		
		if (this.domain)
			tags.push(this.domain);
		if (this.stage)
			tags.push(this.stage);
			
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

	ExperienceController.prototype.add = function()
	{
		var _this = this;
	
		if (this.instance)
		{
			var updateData = {};
			
			if (this.instance.organization() != this.newExperience.organization())
				updateData['organization'] = this.newExperience.organization().urlPath();
			if (cr.stringChanged(this.instance.customOrganization(), this.newExperience.customOrganization()))
				updateData['custom organization'] = this.newExperience.customOrganization();
					
			if (this.instance.site() != this.newExperience.site())
				updateData['site'] = this.newExperience.site().urlPath();
			if (cr.stringChanged(this.instance.customSite(), this.newExperience.customSite()))
				updateData['custom site'] = this.newExperience.customSite();
					
			if (this.instance.offering() != this.newExperience.offering())
				updateData['offering'] = this.newExperience.offering().urlPath();
			if (cr.stringChanged(this.instance.customOffering(), this.newExperience.customOffering()))
				updateData['custom offering'] = this.newExperience.customOffering();
					
			if (cr.stringChanged(this.instance.start(), this.newExperience.start()))
				updateData['start'] = this.newExperience.start();
			if (cr.stringChanged(this.instance.end(), this.newExperience.end()))
				updateData['end'] = this.newExperience.end();
			if (cr.stringChanged(this.instance.timeframe(), this.newExperience.timeframe()))
				updateData['timeframe'] = this.newExperience.timeframe();
			
			var newServices = this.distinctExperienceServices();
			var oldServices = this.instance.experienceServices();
			var newCustomServices = this.customServices();
			var oldCustomServices = this.instance.customServices();
			
			var j = 0;
			var subChanges;
			subChanges = [];
			newServices.forEach(function(d)
				{
					if (j < oldServices.length)
					{
						var oldService = oldServices[j];
						if (oldService.service().id() != d.service().id())
							subChanges.push({id: oldService.id(), service: d.service().urlPath()});
						++j;
					}
					else
					{
						d.clientID('S{0}'.format(j));
						subChanges.push({add: d.clientID(), service: d.service().urlPath()});
					}
				});
			while (j < oldServices.length)
			{
				var oldService = oldServices[j];
				subChanges.push({'delete': oldService.id()});
				++j;
			}
			if (subChanges.length > 0)
				updateData['services'] = subChanges;
			
			j=0;	
			subChanges = [];
			newCustomServices.forEach(function(d)
				{
					if (j < oldCustomServices.length)
					{
						var oldService = oldCustomServices[j];
						if (oldService.name() != d.name())
							subChanges.push({id: oldService.id(), name: d.name()});
					}
					else
					{
						d.clientID('CS{0}'.format(j));
						subChanges.push({add: d.clientID(), name: d.name()});
					}
					++j;
				});
			while (j < oldCustomServices.length)
			{
				var oldService = oldCustomServices[j];
				subChanges.push({'delete': oldService.id()});
				++j;
			}
			if (subChanges.length > 0)
				updateData['custom services'] = subChanges;
				
			bootstrap_alert.show($('.alert-container'), "Saving Experience...", "alert-info");
			
			return this.instance.update(updateData, false)
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							/* Add any services and custom services from newExperience to instance. */
							_this.instance.pushNewElements(_this.experienceServices(),
														   _this.instance.experienceServices())
										  .pushNewElements(_this.customServices(),
														   _this.instance.customServices())
										  .updateData(changes, newIDs)
							r2.resolve(changes, newIDs);
						}
						catch(err)
						{
							r2.reject(err);
						}
						return r2;
					});
		}
		else
		{
			/* Test case: add an experience to a path. */
			bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

			var initialData = {};

			this.appendData(initialData, '1');
		
			initialData['add'] = '1';
			return this.path.update({'experiences': [initialData]}, false)
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							_this.path.experiences().push(_this.newExperience);
							_this.newExperience.clientID('1');
							/* Remove from the experience any experiences that are
								duplicated in the offering services */
							_this.newExperience.experienceServices(_this.distinctExperienceServices());
							_this.path.updateData(changes, newIDs)
							r2.resolve(changes, newIDs);
						}
						catch(err)
						{
							r2.reject(err);
						}
						return r2;
					});
		}
	}
	
	ExperienceController.prototype.initPreviousDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newExperience.start("{0}-{1}".format(todayDate.getUTCFullYear() - 1, getMonthString(todayDate)));
		this.newExperience.end("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
	}
	
	ExperienceController.prototype.initCurrentDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newExperience.start("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
		this.newExperience.end("");
	}
	
	ExperienceController.prototype.initGoalDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newExperience.start("");
		this.newExperience.end("");
	}
	
	ExperienceController.prototype.initDateRange = function(phase)
	{
		if (phase === 'Goal')
			this.initGoalDateRange();
		else if (phase === 'Current')
			this.initCurrentDateRange();
		else
		{
			phase = 'Previous';
			this.initPreviousDateRange();
		}
		this.timeframe(phase);
	}
	
	ExperienceController.prototype.service = function(service)
	{
		if (!service)
			throw new Error("service is not specified");
			
		if (service instanceof cr.Service)
		{
			var services = [new cr.ExperienceService()];
			services[0].service(service)
					   .position(0);
			this.newExperience.experienceServices(services);
		}
		else
		{
			var services = [new cr.ExperienceCustomService()];
			services[0].name(service)
					   .position(0);
			this.newExperience.customServices(services);
		}
		return this;
	}
	
	ExperienceController.prototype.createFromSite = function(d, services, previousNode, done)
	{
		this.initPreviousDateRange();
		
		this.organization(d.organization())
			.customOrganization(null)
			.site(d)
			.customSite(null);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
			
		var panel = new NewExperiencePanel(this);
		done(panel.node());
	}

	ExperienceController.prototype.createFromOffering = function(d, services, previousNode, done)
	{
		if (!d.organization())
			throw new Error("Runtime Error: Organization is not present in offering record.")
		if (!d.site())
			throw new Error("Runtime Error: Site is not present in offering record.")

		this.initPreviousDateRange();
		
		this.offeringPicked(d);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
			
		var panel = new NewExperiencePanel(this);
		done(panel.node());
	}
	
	ExperienceController.prototype.createFromService = function(d, previousNode, done)
	{
		this.initPreviousDateRange();
		
		var service = this.addService(d);
		var panel = new NewExperiencePanel(this);
		done(panel.node());
	}
	
	ExperienceController.prototype.getOfferingConstraint = function()
	{
		if (this.experienceServices().length > 0 &&
			this.experienceServices()[0])
			return '[service>service={0}]'.format(this.experienceServices()[0].service().id());
		else if (this.domain())
			return '[service>service={0}]'.format(this.domain().id());
		else if (this.stage())
			return '[service>service[stage={0}]]'.format(this.stage());
		else
			return "";
	}
	
	ExperienceController.prototype.replaced = function(instance)
	{
		this.instance = instance;
	}
	
	function ExperienceController(path, dataExperience)
	{
		if (!path)
			throw "path is not specified";
		if (typeof(path) !== "object")
			throw "path is not an object";
			
		this.newExperience = new cr.Experience();
		this.newExperience.path(path);
		this.path = path;
		
		if (dataExperience)
		{
			dataExperience.duplicateData(this.newExperience);
		}
		else
		{
			this.newExperience.setDefaultValues();
		}
		this.newExperience.privilege(path.privilege());
	}
	
	return ExperienceController;
})();

var MultiTypeOptionView = (function() {
	MultiTypeOptionView.prototype = new SearchOptionsView();
	MultiTypeOptionView.prototype.containerNode = null;
	MultiTypeOptionView.prototype.experienceController = null;
	MultiTypeOptionView.prototype.typeName = "";
	MultiTypeOptionView.prototype.initialTypeName = "";
	
	MultiTypeOptionView.prototype.hasNamedButton = function(compareText)
	{
		if (compareText.length === 0)
			return true;
		var data = this.buttons().data();
		return data.find(function(d) {
				console.assert(d.names());
				return d.names().find(
					function(d) { return d.text().toLocaleLowerCase() === compareText;}) ||
					(d.description && d.description().toLocaleLowerCase() === compareText);
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
		
		console.assert(d.description)
		return this.stringContains(d.description(), compareText);
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
		return crf.appendItemList(d3.select(this.containerNode))
			.classed('hover-items search', true);
	}
	
	function MultiTypeOptionView(containerNode, experienceController)
	{
		this.containerNode = containerNode;
		if (containerNode)
		{
			console.assert(experienceController);
			console.assert(experienceController instanceof ExperienceController);

			this.experienceController = experienceController;
		}
		SearchOptionsView.call(this, containerNode, GetDataChunker)
	}
	
	return MultiTypeOptionView;
	
})();

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
		if (d instanceof cr.Service)
		{
			if (prepareClick('click', 'service: ' + d.description()))
			{
				if (!this.experienceController.offeringName() &&
					this.experienceController.experienceServices().find(function(es)
						{
							return es.service().id() == d.id();
						}))
					this.experienceController.customOffering(d.description())
								   .offering(null);
				else
					this.experienceController.addService(d);
				this.sitePanel.onExperienceUpdated();
				this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		else if (d instanceof cr.Organization)
		{
			if (prepareClick('click', 'organization: ' + d.description()))
			{
				try
				{
					/* Clear the site and offering if they aren't within the new organization. */
					this.experienceController.organizationPicked(d);
					
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
		else if (d instanceof cr.Site)
		{
			if (prepareClick('click', 'site: ' + d.description()))
			{
				/* Need to check the cells in case this site was a value within an offering. */
				d.promiseData(['address', 'parents'])
					.then(function()
						{
							try
							{
								_this.experienceController.sitePicked(d);
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
		else if (d instanceof cr.Offering)
		{
			if (prepareClick('click', 'offering: ' + d.description()))
			{
				this.experienceController.offeringPicked(d);
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
		var compareText = d.description();
	
		var data = this.buttons().data();
		return data.find(function(d) {
				return d instanceof cr.Site &&
					   d.description() === compareText &&
					   d.organization().description() === compareText;
			});
	}
	
	ExperienceDatumSearchView.prototype.fields = function(compareText)
	{
		var resultType = this.resultType(compareText);
		if (resultType == cr.Site)
			return ['parents', 'address'];
		else if (resultType == cr.Offering)
			return ['parents', 'services'];
		else
			return ['parents'];
	}
	
	ExperienceDatumSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		/* Do not display organizations if there is a site with the same name. */
		if (d instanceof cr.Organization &&
			this.hasUniqueSite(d))
			return false;
		
		if (this.isMatchingDatum(d, compareText))
			return true;

		if (d instanceof cr.Offering)
		{
			console.assert(d.organization());
			console.assert(d.site());
			if (this.stringContains(d.site().description(), compareText))
				return true;
			if (this.stringContains(d.organization().description(), compareText))
				return true;
		}
		else if (d instanceof cr.Site)
		{
			console.assert(d.organization());
			if (this.stringContains(d.organization().description(), compareText))
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

	function ExperienceDatumSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		this.typeNames = [""];
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.initialTypeName;
		this.sitePanel = sitePanel;
		MultiTypeOptionView.call(this, containerNode, experienceController);
		
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
					var i = _this.typeNames.indexOf(_this.typeName);
					if (i < _this.typeNames.length - 1)
					{
						_this.typeName = _this.typeNames[i+1];
						_this.setupChunkerArguments(_this._foundCompareText);
						this.checkStart(_this._foundCompareText);
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
	TagSearchView.prototype.experienceController = null;
	
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
		if (this.focusNode.value)
			TagPoolView.prototype.setFlagVisibles.call(this);
		else if (this.focusNode != this.firstTagInputNode() ||
				 (this.experienceController.offering() &&
			 	  this.experienceController.offering().offeringServices().length > 0))
		{
			this.flags().each(function(fs)
				{
					fs.visible = (fs.service.serviceImplications().length > 1) ? false : undefined;
				});
		}
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
					fs.visible = (types.indexOf(fs.description()) < 0 ? false : undefined);
				});
		}
	}

	TagSearchView.prototype.filterFlags = function(filterText)
	{
		TagPoolView.prototype.filterFlags.call(this, filterText);
		
		if (filterText)
		{
			var flags = this.flags().filter(function(fs) { return fs.visible || fs.visible === undefined; });
			var flagData = flags.data();
			var flagDescriptions = flagData.map(function(fs) { return fs.description().toLocaleUpperCase(); });
			
			var flagIndexOf = function(s)
			{
				var min, mid, max;
				min = 0; 
				max = flagData.length - 1;
				
				var t = s;
				while (max >= min)
				{
					mid = Math.floor((min + max) / 2);
					var target = flagDescriptions[mid];
					if (target < t)
						min = mid + 1;
					else if (target > t)
						max = mid - 1;
					else
						return mid;
				}
				return -1;
			}
			
			var flagIndex = flagIndexOf(filterText.toLocaleUpperCase());
			if (flagIndex >= 0)
			{
				var rootService = flagData[flagIndex];
				// Add to the visible list any item that contains the root service as a sub service.
				this.flags().each(function(fs)
					{
						if (!fs.visible && fs.service.serviceImplications().find(function(subService)
							{
								return subService.service().id() == rootService.service.id();
							}))
							fs.visible = true;
					});
				flags = this.flags().filter(function(fs) { return fs.visible || fs.visible === undefined; });
				flagData = flags.data();
				flagDescriptions = flagData.map(function(fs) { return fs.description().toLocaleUpperCase(); });
			}
			
			var levels = {};
			var levelCount = 1;
			var flagServices = {};
			
			// Fill flagServices with all of the subServices associated with each flag that are
			// in the set of visible flags except for the service itself.
			flags.each(function(fs)
			{
				flagServices[fs.service.id()] = fs.service.serviceImplications()
					.map(function(serviceImplication) { return serviceImplication.service(); })
					.filter(function(s) {
						return flagIndexOf(s.description().toLocaleUpperCase()) >= 0 && 
										   s.id() != fs.service.id();
					});
			});
			
			for (levelCount = 1; 
			     (Object.keys(levels).length < flagData.length &&
				   levelCount <= 3);
				 ++levelCount)
			{
				flags.each(function(fs)
				{
					var thisID = fs.service.id();
					
					if (!(thisID in levels))
					{
						// Add a service into the levels list if all of its visible flags 
						// are already in the levels except for itself.
						var f = function(s)
							{
								return s.id() in levels && levels[s.id()] < levelCount;
							};
						
						if (flagServices[thisID].filter(f).length == flagServices[thisID].length)
							levels[thisID] = levelCount;
					}
				});
			}
			
			flags.each(function(fs)
				{
					fs.visible = fs.service.id() in levels;
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
		serviceID = service.id();
		
		return this.sitePanel.allServices.find(function(s)
			{
				if (s.id() == serviceID)
					return false;
				return s.serviceImplications().find(function(subS)
					{
						return subS.service().id() == serviceID;
					});
			});
	}
	
	TagSearchView.prototype.onClickButton = function(d) {
		if (prepareClick('click', 'service: ' + d.description()))
		{
			try
			{
				/* If the user clicks a flag that is the same as the flag already there, then move on. 
					If the user clicks a flag that has no sub-flags other than itself, then move on.
					Otherwise, stay there.
				 */	
				var d3Focus = this.focusNode && this.focusNode.parentNode && d3.select(this.focusNode);
				var newDatum;
				
				var moveToNewInput = !this.hasSubService(d.service) ||
					(this.focusNode && 
					 this.focusNode.value.toLocaleUpperCase() == d.description().toLocaleUpperCase());
					
				if (d3Focus && d3Focus.datum())
				{
					var oldService = d3Focus.datum();
					if (oldService instanceof cr.ServiceLinkInstance)
					{
						/* Replace the old experienceService with a new one. */
						if (this.experienceController.experienceServices().indexOf(oldService) >= 0)
						{
							oldService.service(d.service)
							     .description(d.service.description())
							     .id(null);
						}
						else
						{
							oldService = this.experienceController.addService(d.service);
						}
					}
					else if (oldService instanceof cr.ExperienceCustomService)
					{
						this.experienceController.removeCustomService(oldService);
						oldService = this.experienceController.addService(d.service);
					}
					else
					{
						console.assert(false);
					}
					this.focusNode.value = d.description();
				}
				else
				{
					this.experienceController.addService(d.service);
				}
				newDatum = d.service;
				
				this.sitePanel.updateInputs();
				this.sitePanel.showTags();

				var container = this.sitePanel.mainDiv.select('.tags-container');
				var node;
				if (moveToNewInput)
					node = null;
				else
					node = container
						.selectAll('input.tag')
						.filter(function(d)	
							{ return d instanceof cr.ServiceLinkInstance &&
									 d.service() == newDatum; })
						.node();
				/* Node can be null if you have just selected a service that is part of
					an offering's services.
				 */
				if (!node)
				{
					var newInput = this.sitePanel.appendTag(container, null);
					newInput.node().focus();
				}
				else
					node.focus();
				unblockClick();
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}

		d3.event.preventDefault();
	}
	
	function TagSearchView(container, sitePanel, experienceController)
	{
		TagPoolView.call(this, container, 'pool-container');
		
		this.sitePanel = sitePanel;
		this.experienceController = experienceController;
		
		this.reveal = new VerticalReveal(container.node());
	}
	
	return TagSearchView;
})();

/* Displays site or organization */
var OrganizationSearchView = (function() {
	OrganizationSearchView.prototype = new ExperienceDatumSearchView();
	
	OrganizationSearchView.prototype.clearFromOrganization = function()
	{
		if (this.experienceController.organization())
		{
			if (this.experienceController.offering())
			{
				this.experienceController.clearOffering();
				this.experienceController.clearSite();
				this.experienceController.clearOrganization();
			}
			else if (this.experienceController.site())
			{
				this.experienceController.clearSite();
				this.experienceController.clearOrganization();
			}
			else
			{
				this.experienceController.clearOrganization();
			}
		}
		else
		{
			this.experienceController.clearOrganization();
		}
	}
	
	OrganizationSearchView.prototype.searchPath = function(val)
	{
		var path;
		if (val)
		{
			if (this.typeName === "Site")
			{
				path = 'site[name>text*="{0}"|organization>name>text*="{0}"]';
			}
			else if (this.typeName === "Organization")
			{
				path = 'organization[name>text*="{0}"]';
			}
		
			return path.format(encodeURIComponent(val));
		}
		else
			return '';
	}
	
	OrganizationSearchView.prototype.resultType = function(val)
	{
		var path;
		if (val)
		{
			if (this.typeName === "Site")
			{
				return cr.Site;
			}
			else if (this.typeName === "Organization")
			{
				return cr.Organization;
			}
			else
				throw new Error("unexpected typeName");
		}
		else
			return null;
	}
	
	OrganizationSearchView.prototype.setupSearchTypes = function(searchText)
	{
		if (searchText)
		{
			this.typeNames = ["Organization", "Site", ];
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
	
	OrganizationSearchView.prototype.fillItems = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text growable", true);
				if (d instanceof cr.Site)
				{
					/* The organization name is either a value of d or, if d is a value
					   of an Offering, then the organization name is the value of the offering.
					 */
					var orgValue;
					if (d.parent() && d.parent() instanceof cr.Offering)
						orgValue = d.parent.organization();
					else
						orgValue = d.organization();
						
					if (orgValue.description() == d.description())
					{
						leftText.text(d.description());
					}
					else
					{
						orgDiv = leftText.append('div').classed("organization", true);		
						orgDiv.append('div').text(orgValue.description());
						orgDiv.append('div')
							.classed('address-line', true)
							.text(d.description());
					}
				}
				else
				{
					leftText.text(d.description());
				}
			});
	}
	
	OrganizationSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.organizationName() || "");
	}
	
	function OrganizationSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return OrganizationSearchView;
})();

/* Displays organization, site, offering */
var SiteSearchView = (function() {
	SiteSearchView.prototype = new ExperienceDatumSearchView();
	
	SiteSearchView.prototype.clearFromSite = function()
	{
		if (this.experienceController.site())
		{
			if (this.experienceController.offering())
			{
				this.experienceController.clearOffering();
				this.experienceController.clearSite();
			}
			else
			{
				this.experienceController.clearSite();
			}
		}
		else
		{
			this.experienceController.clearSite();
		}
	}
	
	SiteSearchView.prototype.searchPath = function(val)
	{
		var path;
		if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization() == null)
			{
				return "";
			}
			else if (!val)
			{
				if (this.typeName === 'Site')
					return this.experienceController.organization().urlPath() + '/site';
				else if (this.typeName === 'Offering from Site')
				{
					path = this.experienceController.organization().urlPath() + '/site/offering';
					path += this.experienceController.getOfferingConstraint();
					return path;
				}
			}
			else
			{
				if (this.typeName === 'Offering')
				{
					path = '[name>text*="{1}"]|[site>name>text*="{1}"]|[site>organization>name>text*="{1}"]';
					path = this.experienceController.organization().urlPath() + '/site/offering' + path;
					path += this.experienceController.getOfferingConstraint();
				}
				else if (this.typeName === 'Site')
				{
					path = this.experienceController.organization().urlPath() + '/site[name>text*="{1}"]';
				}
			
				var symbol = "*=";
			
				return path.format(symbol, encodeURIComponent(val));
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (!val)
			{
				return "";
			}
			else
			{
				if (this.typeName === "Offering")
				{
					path = 'offering[name>text*="{1}"]|[site>name>text*="{1}"]|[site>organization>name>text*="{1}"]';
					path += this.experienceController.getOfferingConstraint();
				}
				else if (this.typeName === 'Site')
				{
					path = 'site[name>text*="{1}"]|[organization>name>text*="{1}"]';
					if (this.experienceController.experienceServices[0] instanceof cr.Service)
					{
						path += '[offering>service>service={0}]]'.format(this.experienceController.experienceServices[0].service().id());
					}
				}
				else if (this.typeName === "Organization")
				{
					path = 'organization[name>text*="{1}"]';
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			

				var symbol = "*=";
			
				return path.format(symbol, val);
			}
		}
		else if (val)
		{
			if (this.typeName === 'Site')
			{
				path = 'site[name>text*="{1}"]|[organization>name>text*="{1}"]';
			}
			else if (this.typeName === "Organization")
			{
				path = 'organization[name>text*="{1}"]';
			}
			var symbol = "*=";
		
			return path.format(symbol, val);
		}
		else
			return '';
	}
	
	SiteSearchView.prototype.resultType = function(val)
	{
		var path;
		if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization() == null)
			{
				return null;
			}
			else if (!val)
			{
				if (this.typeName === 'Site')
					return cr.Site;
				else if (this.typeName === "Offering from Site")
				{
					return cr.Offering;
				}
			}
			else
			{
				if (this.typeName === "Offering")
				{
					return cr.Offering;
				}
				else if (this.typeName === 'Site')
				{
					return cr.Site;
				}
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (!val)
			{
				return null;
			}
			else
			{
				if (this.typeName === "Offering")
				{
					return cr.Offering;
				}
				else if (this.typeName === 'Site')
				{
					return cr.Site;
				}
				else if (this.typeName === "Organization")
				{
					return cr.Organization;
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			}
		}
		else if (val)
		{
			if (this.typeName === 'Site')
			{
				return cr.Site;
			}
			else if (this.typeName === "Organization")
			{
				return cr.Organization;
			}
		}
		else
			return null;
	}
	
	SiteSearchView.prototype.setupSearchTypes = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (searchText)
					this.typeNames = ['Site', "Offering"];
				else
					this.typeNames = ['Site'];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (searchText)
				this.typeNames = ["Offering", 'Site', "Organization"];
			else
				this.typeNames = [""];
		}
		else if (searchText)
		{
			this.typeNames = ['Site', "Organization"];
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
	
	SiteSearchView.prototype.fillItems = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text growable", true);
				if (d instanceof cr.Offering)
				{
					leftText.append('div')
						.classed('title', true).text(d.description());

					var orgDiv = leftText.append('div')
						.classed("organization", true);
					orgDiv.append('div')
						.classed('address-line', true)
						.text(d.organization().description());
						
					if (d.site().description() != d.organization().description())
					{
						orgDiv.append('div')
							.classed('address-line', true)
							.text(d.site().description());
					}
				}
				else if (d instanceof cr.Site)
				{
					/* The organization name is either a value of d or, if d is a value
					   of an Offering, then the organization name is the value of the offering.
					 */
					var orgValue;
					if (d.parent() && d.parent() instanceof cr.Offering)
						orgValue = d.parent().organization();
					else
						orgValue = d.organization();
						
					if (orgValue.description() == d.description() ||
						orgValue.id() == (_this.experienceController.organization() && _this.experienceController.organization().id()))
					{
						leftText.text(d.description());
					}
					else
					{
						orgDiv = leftText.append('div').classed("organization", true);		
						orgDiv.append('div').text(orgValue.description());
						orgDiv.append('div')
							.classed('address-line', true)
							.text(d.description());
					}
				}
				else
				{
					leftText.text(d.description());
				}
			});
	}
	
	SiteSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.siteName() || "");
	}
	
	function SiteSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return SiteSearchView;
})();

/* Typenames can be "Offering" or "Offering from Site" or "Service". The return types can be Offerings. */
var OfferingSearchView = (function() {
	OfferingSearchView.prototype = new ExperienceDatumSearchView();
	
	OfferingSearchView.prototype.clearFromOffering = function()
	{
		this.experienceController.clearOffering();
	}
	
	OfferingSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d instanceof cr.Service)
		{
			if (prepareClick('click', 'service for offering: ' + d.description()))
			{
				this.experienceController.customOffering(d.description())
							   .offering(null);
				
				this.sitePanel.onExperienceUpdated();
				this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		else if (d instanceof cr.Offering)
		{
			if (prepareClick('click', 'offering: ' + d.description()))
			{
				this.experienceController.offeringPicked(d);
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

		if (this.experienceController.siteName())
		{
			if (this.experienceController.site)
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						return this.experienceController.site().urlPath() + "/offering";
					}
					else
						throw new Error('unrecognized typeName');
				}
				else
				{
					if (this.typeName === "Offering")
					{
						path = this.experienceController.site().urlPath() + '/offering[name>text*="{1}"]';
					}
					else
						throw new Error('unrecognized typeName');
			
					var symbol = "*=";
			
					return path.format(symbol, encodeURIComponent(val));
				}
			}
			else if (val)
			{
				throw new Error("Unreachable code");
			}
			else
				return '';
		}
		else if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						path = this.experienceController.organization().urlPath() + '/site/offering';
						path += this.experienceController.getOfferingConstraint();
						return path;
					}
					else
						return "Service";
				}
				else
				{
					if (this.typeName === "Offering")
					{
						path = '[name>text*="{1}"]|[site>name>text*="{1}"]';
						path = this.experienceController.organization().urlPath() + '/site/offering' + path;
						path += this.experienceController.getOfferingConstraint();
					}
			
					var symbol = "*=";
			
					return path.format(symbol, encodeURIComponent(val));
				}
			}
			else
			{
				console.assert(false) /* Unreachable code */;
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (val)
			{
				if (this.typeName === "Offering")
				{
					path = 'offering[name>text*="{1}"]|[site>name>text*="{1}"]|[site>organization>name>text*="{1}"]';
					path += this.experienceController.getOfferingConstraint();
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			

				var symbol = "*=";
			
				return path.format(symbol, encodeURIComponent(val));
			}
			else
			{
				path = "offering";
				path += this.experienceController.getOfferingConstraint();
				return path;
			}
		}
 		else if (val)
		{
			if (this.typeName === "Offering")
			{
				path = 'offering[name>text*="{1}"]' +
						this.experienceController.getOfferingConstraint();
			}
			else
				throw new Error("Unrecognized typeName: {0}".format(this.typeName));
				
			var symbol = "*=";
		
			return path.format(symbol, encodeURIComponent(val));
		}
		else
			return '';
	}
	
	OfferingSearchView.prototype.resultType = function(val)
	{
		var path;

		if (this.experienceController.siteName())
		{
			if (this.experienceController.site)
			{
				if (this.typeName === "Offering")
					return cr.Offering;
				else
					throw new Error('unrecognized typeName');
			}
			else if (val)
			{
				throw new Error("Unreachable code");
			}
			else
				return '';
		}
		else if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						return cr.Offering;
					}
					else
						return cr.Service;
				}
				else
				{
					if (this.typeName === "Offering")
					{
						return cr.Offering;
					}
				}
			}
			else
			{
				throw new Error("Unreachable code");
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (val)
			{
				if (this.typeName === "Offering")
				{
					return cr.Offering;
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			}
			else
			{
				return cr.Offering;
			}
		}
 		else if (val)
		{
			if (this.typeName === "Offering")
				return cr.Offering;
			else
				throw new Error("Unrecognized typeName: {0}".format(this.typeName));
		}
		else
			return '';
	}
	
	OfferingSearchView.prototype.setupSearchTypes = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experienceController.siteName())
		{
			if (this.experienceController.site)
			{
				this.typeNames = ["Offering"];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (searchText)
					this.typeNames = ["Offering"];
				else if (this.experienceController.getOfferingConstraint())
					this.typeNames = ["Offering"];
				else
					this.typeNames = ["Service"];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			this.typeNames = ["Offering"];
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
	
	OfferingSearchView.prototype.fillItems = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text growable", true);
				if (d instanceof cr.Offering)
				{
					if (_this.experienceController.site() && _this.experienceController.site().id() == d.site().id())
						leftText.text(d.description());
					else
					{
						leftText.append('div')
							.classed('title', true).text(d.description());
	
						orgDiv = leftText.append('div').classed("organization", true);
						if (d.organization().id() !=
							(_this.experienceController.organization() && _this.experienceController.organization().id()))
							orgDiv.append('div').text(d.organization().description());
						if (d.site().description() != d.organization().description())
						{
							orgDiv.append('div')
								.classed('address-line', true)
								.text(d.site().description());
						}
					}
				}
				else if (d instanceof cr.Service)
				{
					leftText.text(d.description());
				}
				else
				{
					leftText.text(d.description());
				}
			});
	}
	
	OfferingSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.offeringName() || "");
	}
	
	function OfferingSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experienceController, inputNode, helpNode);
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
			jNode.css('padding-top', "0px")
				 .css('padding-bottom', "0px");
		}
		else if (args.newHeight == 'auto')
		{
			/* This hack smells bad, but it seems to work. The problem occurs in that the code
				below doesn't do the right thing if this item has padding on the bottom. (and maybe the top,
				but I didn't test that. */
			var outerHeight = jNode.outerHeight(false);
			jNode.height(oldHeight);
			jNode.animate({height: outerHeight, "padding-top": "0px", "padding-bottom": "0px"}, {duration: duration, easing: 'swing', step: step, done: done});
			
		}
		else
		{
			var height = jNode.height();
			jNode.height(oldHeight);
			jNode.animate({height: height, "padding-top": "0px", "padding-bottom": "0px"}, {duration: duration, easing: 'swing', step: step, done: done});
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
		var oldPaddingTop = jNode.css('padding-top');
		var oldPaddingBottom = jNode.css('padding-bottom');
		jNode.css('padding-top', '0px')
			 .css('padding-bottom', '0px')
			 .height(0);
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
			jNode.css('padding-top', oldPaddingTop)
				 .css('padding-bottom', oldPaddingBottom)
				 .height(oldHeight)
				 .animate({height: '0px', 'padding-top': '0px', 'padding-bottom': '0px'}, {duration: duration, easing: 'swing', step: step, done: 
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
			.text(crv.buttonTexts.cancel)
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
			var duplicateText = (path == cr.signedinUser.path()) ? "Duplicate Experience" : "Add to My Pathway";
		
			var addToMyPathwayButton = div.append('button')
				.text(duplicateText)
				.classed("site-active-text", true)
				.on("click", function()
					{
						if (prepareClick('click', duplicateText))
						{
							var experienceController = new ExperienceController(experience.path(), experience);
							var newPanel = new NewExperiencePanel(experienceController);
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
										.format(window.location.origin, experience.id());
							unblockClick();
						});
						dimmer.hide();
					}
				});
				
		$(emailAddExperienceButton.node()).on('blur', onCancel);
		
		var cancelButton = div.append('button')
			.text(crv.buttonTexts.cancel)
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
	NewExperiencePanel.prototype.nameOrTagRequiredMessage = 'Your experience needs at least a tag or a title.';
	NewExperiencePanel.prototype.firstTagHelp = 'What type of experience is this?';
	NewExperiencePanel.prototype.otherTagHelp = 'What other tag goes with this experience?';
	NewExperiencePanel.prototype.organizationDefaultPlaceholder = 'Organization (Optional)';
	NewExperiencePanel.prototype.siteDefaultPlaceholder = 'Location (Optional)';
	NewExperiencePanel.prototype.offeringDefaultPlaceholder = 'Title';
	
	NewExperiencePanel.prototype.appendHidableDateInput = function(dateContainer, minDate, maxDate)
	{
		var _this = this;
		var itemsDiv = crf.appendItemList(dateContainer)
			.classed('overlined', true);
		var itemDiv = itemsDiv.append('li');
		var dateSpan = itemDiv.append('span')
			.classed('growable', true);
		var dateWheel = new DateWheel(dateContainer.node().parentNode, function(newDate)
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
		
		var notSureButton = d3.select(dateContainer.node().parentNode).append('div')
				.classed('not-sure-button site-active-text', true)
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
		notSureButton.append('div').text("Not Sure");
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
				if (d instanceof cr.Service)
					service = d;
				else if (d instanceof cr.ServiceLinkInstance)
					service = d.service();
			}
			
			if (service)
			{
				pathGuide = PathGuides.data[service.getColumn()];
		
				d3.select(node)
					.style('background-color', pathGuide.flagColor)
					.style('border-color', pathGuide.poleColor)
					.style('color', pathGuide.fontColor);
			}
			else if (d)
			{
				pathGuide = PathGuides.data[PathGuides.data.length - 1];
		
				d3.select(node)
					.style('background-color', pathGuide.flagColor)
					.style('border-color', pathGuide.poleColor)
					.style('color', pathGuide.fontColor);
			}
			else
			{
				d3.select(node)
					.style('background-color', null)
					.style('border-color', null)
					.style('color', null);
			}
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
		var input = container.insert('input', 'button')
			.datum(instance)
			.classed('tag', true)
			.attr('placeholder', 'Tag')
			.attr('value', instance && instance.description());
			
		$(input.node()).on('click', function(e)
			{
				this.setSelectionRange(0, this.value.length);
				e.preventDefault();
			});
		
		var _this = this;	
		
		$(input.node()).on('input', function()
			{
				/* Check for text changes for all input boxes.  */
				if (this == document.activeElement)
				{
					if (!document.activeElement.value)
						_this.hideAddTagButton();
					else
						_this.showAddTagButton();
					_this.tagSearchView.constrainTagFlags();
				}
				_this.setTagInputWidth(this);
			})
			.on('focusin', function()
			{
				try
				{
					_this.tagSearchView.focusNode = this;
					_this.onFocusInTagInput(this);
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			})
			.on('focusout', function()
			{
				_this.setTagInputWidth(this);
				_this.setPlaceholders();
				if (!_this.inMouseDown)
				{
					_this.checkTagInput();
					_this.showAddTagButton();
				}
			})
			.keypress(function(e) {
				if (e.which == 13)
				{
					_this.checkTagInput();
					_this.showAddTagButton();
					e.preventDefault();
				}
			})
			.keydown( function(event) {
				if (event.keyCode == 9) {
					/* If this is an empty node with no instance to remove, then don't handle here. */
					if (!input.node().value && !instance)
						return;
					/* If this is a node whose value matches the previous value, then don't handle here. */
					else if (instance && input.node().value == instance.description())
						return;
					else if (instance && input.node().value != instance.description())
					{
						_this.checkTagInput();
						_this.showAddTagButton();
						/* Do not prevent default. */
					}
					else
					{
						_this.checkTagInput();
						_this.showAddTagButton();
						_this.tagSearchView.constrainTagFlags();
						event.preventDefault();
					}
				}
			});

		this.setTagInputWidth(input.node());
		
		return input;
	}
	
	NewExperiencePanel.prototype.showTags = function()
	{
		var offeringTags = [];
		var tags = [];
		var _this = this;
		
		var offering = this.experienceController.offering();
		if (offering && offering.id())
		{
			offeringTags = offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(s) { return s.service(); });
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
				.text(function(d) { return d.description(); })
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
		tags = tags.concat(this.experienceController.experienceServices()
			.filter(function(s) 
			{
				sDescription = s.description();
				return !offeringTags.find(function(d)
					{
						return d.description() === sDescription;
					})
			}));
		tags = tags.concat(this.experienceController.customServices()
			.filter(function(s) 
			{
				sDescription = s.description();
				return !offeringTags.find(function(d)
					{
						return d.description() === sDescription;
					}) &&
					!tags.find(function(d) 
					{ 
						return d.description() === sDescription; 
					})
			}));
		
		tagDivs.filter(function(d) { return d == null || tags.indexOf(d) < 0; } ).remove();
		
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
				input.node().value = tags[i].description();
				this.setTagInputWidth(input.node());
			}
		}
	}
	
	NewExperiencePanel.prototype._serviceLabel = function(service, namesFunction)
	{
		if (!service)
			return "";
		
		var names = namesFunction(service);
		if (names && names.length)
			return names[0];	
			
		var subObj = service.serviceImplications().find(function(s)
			{
				var names = namesFunction(s.service());
				return names && names.length;
			});
		return subObj && namesFunction(subObj.service())[0];
	}
	
	NewExperiencePanel.prototype.setPlaceholders = function()
	{
		var experienceService = this.experienceController.experienceServices().find(function(s)
			{
				return s.service().getColumn() < PathGuides.data.length - 1;
			});
		
		var service = experienceService && experienceService.service();
			
		this.organizationInput
			.attr('placeholder', 
				  (service && this._serviceLabel(service, function(s) { return s.organizationLabels(); })) || this.organizationDefaultPlaceholder);
		this.siteInput
			.attr('placeholder', 
				  (service && this._serviceLabel(service, function(s) { return s.siteLabels(); })) || this.siteDefaultPlaceholder);
		this.offeringInput
			.attr('placeholder', 
				  (service && this._serviceLabel(service, function(s) { return s.offeringLabels(); })) || this.offeringDefaultPlaceholder);
	}
	
	NewExperiencePanel.prototype.updateInputs = function()
	{
		/* Reset the placeholders to ensure that they are properly displayed or hidden given
			the changes in the values. This fixes a bug on MacOS Safari.
		 */
		this.organizationInput.attr('placeholder', null);
		this.siteInput.attr('placeholder', null);
		this.offeringInput.attr('placeholder', null);
		
		this.organizationInput.node().value = this.experienceController.organizationName();
		this.siteInput.node().value = this.experienceController.siteName();
		this.offeringInput.node().value = this.experienceController.offeringName();

		this.setPlaceholders();
	}

	NewExperiencePanel.prototype.onExperienceUpdated = function()
	{
		this.updateInputs();
		this.showTags();
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
				newInstance.id() != (this.experienceController.organization() && this.experienceController.organization().id()))
				{
					if (newInstance instanceof cr.Organization)
						this.experienceController.organizationPicked(newInstance);
					else if (newInstance instanceof cr.Site)
						this.experienceController.sitePicked(newInstance);
					else
						console.assert(false);
				}
			else if (newText != this.experienceController.organizationName())
			{
				if (this.experienceController.organization())
				{
					this.organizationSearchView.clearFromOrganization();
					this.experienceController.customOrganization(newText);
				}
				else
				{
					this.experienceController.customOrganization(newText)
											 .organization(null);
				}
			}
		}
		else
			this.organizationSearchView.clearFromOrganization();
	}
		
	NewExperiencePanel.prototype.checkSiteInput = function()
	{
		var newText = this.siteSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.siteSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.id() != (this.experienceController.site() && this.experienceController.site().id()))
			{
				if (newInstance instanceof cr.Site)
					this.experienceController.sitePicked(newInstance);
				else if (newInstance instanceof cr.Offering)
					this.experienceController.offeringPicked(newInstance);
				else
					console.assert(false);
			}
			else if (newText != this.experienceController.siteName())
				if (this.experienceController.site())
				{
					this.siteSearchView.clearFromSite();
					this.experienceController.customSite(newText);
				}
				else
				{
					this.experienceController.customSite(newText)
											 .site(null);
				}
		}
		else
			this.siteSearchView.clearFromSite();
	}
		
	NewExperiencePanel.prototype.checkOfferingInput = function()
	{
		var newText = this.offeringSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.offeringSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.id() != (this.experienceController.offering() && this.experienceController.offering().id()))
			{
				if (newInstance instanceof cr.Offering)
					this.experienceController.offeringPicked(newInstance);
				else
					console.assert(false);
			}
			else if (newText != this.experienceController.offeringName())
				this.experienceController.customOffering(newText)
										 .offering(null);
		}
		else
		{
			this.offeringSearchView.clearFromOffering();
		}
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
					
				var newText = this.value.trim();
				var newService = newText && _this.tagSearchView.hasNamedService(newText.toLocaleLowerCase());
				if (!newText)
				{
					if (d instanceof cr.ExperienceService)
					{
						/* Remove a standard service */
						_this.experienceController.removeService(d);
					}
					else if (d instanceof cr.ExperienceCustomService)
					{
						/* Remove a custom service */
						_this.experienceController.removeCustomService(d);
					}
					else if (d)
						throw new Error("Invalid object to remove");
					$(this).remove();
				}
				else if (d instanceof cr.ExperienceService)
				{
					if (!newService)
					{
						/* Replace standard service with a custom service */
						_this.experienceController.removeService(d);
						var newValue = _this.experienceController.addService(newText);
						d3.select(this).datum(newValue);
						$(this).trigger('input');
					}
					else if (newService != d.service())
					{
						/* Replace standard service with a different standard service */
						d.service(newService)
						 .description(newService.description());
						this.value = newService.description();
						$(this).trigger('input');
					}
					else
						{	/* No change */ }
				}
				else if (d instanceof cr.ExperienceCustomService)
				{
					if (!newService)
					{
						if (newText != d.name())
						{
							/* Replace custom service with a different custom service */
							d.name(newText)
							 .description(newText);
							this.value = newText;
							$(this).trigger('input');
						}
					}
					else
					{
						/* Replace a custom service with a standard service */
						_this.experienceController.removeCustomService(d);
						var newValue = _this.experienceController.addService(newService);
						d3.select(this).datum(newValue);
						this.value = newService.description();
						$(this).trigger('input');
					}
				}
				else
				{
					/* The blank tag. */
					_this.experienceController.addService(newService || newText);
					_this.showTags();
					this.value = "";
					$(this).attr('placeholder', $(this).attr('placeholder'));
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
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (newReveal != this.siteSearchView.reveal &&
			this.siteSearchView.reveal.isVisible())
		{
			this.checkSiteInput();
			this.siteSearchView.hideSearch(done);
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (newReveal != this.offeringSearchView.reveal &&
			this.offeringSearchView.reveal.isVisible())
		{
			this.checkOfferingInput();
			this.offeringSearchView.hideSearch(done);
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (newReveal != this.tagSearchView.reveal &&
			this.tagSearchView.reveal.isVisible())
		{
			this.checkTagInput();
			this.showAddTagButton();
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
			(!this.experienceController.offering() ||
			  this.experienceController.offering().offeringServices().length == 0))
			this.tagHelp.text(this.firstTagHelp);
		else
			this.tagHelp.text(this.otherTagHelp);
	}
	
	NewExperiencePanel.prototype.hideAddTagButton = function()
	{
		var button = this.mainDiv.select('.tags-container>button');
		if (button.style('display') != 'none')
		{
			button.interrupt().transition()
				.style('opacity', 0)
				.each('end', function()
					{
						button.style('display', 'none');
					});
		}
	}
	
	NewExperiencePanel.prototype.showAddTagButton = function()
	{
		var button = this.mainDiv.select('.tags-container>button');
		if (button.style('display') == 'none')
		{
			button.style('display', null);
			button.interrupt().transition()
				.style('opacity', 1)
				.each('end', function()
					{
						button.style('display', null);
					});
		}
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
					if (!inputNode.value)
						_this.hideAddTagButton();
					else
						_this.showAddTagButton();
						
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
			if (!inputNode.value)
				_this.hideAddTagButton();
			else
				_this.showAddTagButton();
				
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
					_this.experienceController.instance.deleteData()
						.then(function() { _this.hideDown(unblockClick) },
							  cr.syncFail);
				}, 
				unblockClick);
		}
	}
	
	function NewExperiencePanel(experienceController, showFunction) {
		this.experienceController = experienceController;
			
		if (this.experienceController.title())
			this.title = this.experienceController.title();
		else if (this.experienceController.instance)
			this.title = this.editTitle;
		else if (this.experienceController.domain())
			this.title = this.newFromDomainTitle.format(this.experienceController.domain().description());
		else if (this.experienceController.stage())
			this.title = this.newFromDomainTitle.format(this.experienceController.stage());
			
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
		backButton.append('span').text(crv.buttonTexts.cancel);
		
		if (experienceController.instance)
		{
			var shareButton = navContainer.appendRightButton()
				.classed("share", true)
				.on('click', function()
					{
						if (prepareClick('click', 'share'))
						{
							new ExperienceShareOptions(_this.node(), experienceController.instance, experienceController.instance.path());
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
							experienceController.start(startDateWheel.value() != '' ? startDateWheel.value() : null);
							experienceController.end(endDateWheel.value() != '' ? endDateWheel.value() : null);
							if (experienceController.start() && experienceController.end())
							{
								experienceController.timeframe(null);
								experienceController.add()
									.then(hidePanel, cr.syncFail);
							}
							else
							{
								var timeframeName;
								
								if (previousExperienceButton.classed('pressed'))
									timeframeName = 'Previous';
								else if (currentExperienceButton.classed('pressed'))
									timeframeName = 'Current';
								else
									timeframeName = 'Goal';
								experienceController.timeframe(timeframeName);

								experienceController.add()
									.then(hidePanel, cr.syncFail);
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
				_this.updateInputs();
				_this.checkTagInput();
						
				if (!experienceController.offeringName() &&
					experienceController.experienceServices().length == 0)
					asyncFailFunction(_this.nameOrTagRequiredMessage);
				else
				{
					doAdd();
				}
				d3.event.preventDefault();
			});
		doneButton.append("span").text(experienceController.instance ? crv.buttonTexts.done : "Add");
		
		if (experienceController.instance)
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
			
		tagsContainer.append('button')
			.classed('site-active-text', true)
			.text('Add Tag')
			.on('click', function()
				{
					$(this).stop()
						.animate({opacity: 0}, {duration: 200})
						.promise()
						.then(function()
							{ 
								_this.checkTagInput(null);
								var tagInput = _this.appendTag(tagsContainer, null);
								tagInput.node().focus();
							});
				});
		
		searchContainer = this.tagsSection.append('div');
		
		this.tagHelp = searchContainer.append('div').classed('tag-help', true);
		this.tagHelp.text(this.firstTagHelp);
			
		this.tagSearchView = new TagSearchView(searchContainer, this, experienceController);
												
		/* Code starting for the date range. */
		var birthday = experienceController.path.birthday() ||
			(function()
			 {
				var todayDate = getUTCTodayDate();
				return "{0}-{1}".format(todayDate.getUTCFullYear() - 100, getMonthString(todayDate));
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
			.classed('overlined', true)
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
			.classed('overlined', true)
			.text("End");
			
		this.endHidable = this.appendHidableDateInput(endDateContainer, new Date(birthday));
		var endDateWheel = this.endHidable.dateWheel;
		
		if (experienceController.newExperience.start())
			startDateWheel.value(experienceController.newExperience.start());
		else
		{
			if (experienceController.end())
			{
				/* Initialize the start date to a reasonable value, not the current date. */
				var startGuessDate = new Date(experienceController.end());
				startGuessDate.setUTCFullYear(startGuessDate.getUTCFullYear() - 1);
				var startGuessDateString = startGuessDate.toISOString().substring(0, 7);
				if (startGuessDateString < birthday)
					startDateWheel.value(birthday);
				else
					startDateWheel.value(startGuessDateString);
			}
			startDateWheel.clear();
		}
			
		if (experienceController.end())
			endDateWheel.value(experienceController.end());
		else
		{
			if (experienceController.start())
			{
				/* Initialize the end date to a reasonable value. */
				var guessDate = new Date(experienceController.start());
				guessDate.setUTCFullYear(guessDate.getUTCFullYear() + 1);
				var guessDateString = guessDate.toISOString().substring(0, 7);
				endDateWheel.value(guessDateString);
			}
			endDateWheel.clear();
		}
				
		/* The organization section. */
		section = panel2Div.append('section')
			.classed('cell picker organization', true);
				
		this.organizationInput = section.append('input')
			.classed('organization', true)
			.attr('placeholder', this.organizationDefaultPlaceholder)
			.attr('value', experienceController.organizationName());
		organizationHelp = section.append('div')
			.classed('help', true);
			
		searchContainer = section.append('div');
			
		this.organizationSearchView = new OrganizationSearchView(searchContainer.node(), 
																 this, experienceController, 
																 this.organizationInput.node(), 
																 organizationHelp.node());
		
		section = panel2Div.append('section')
			.classed('cell picker site', true);
				
		this.siteInput = section.append('input')
			.classed('site', true)
			.attr('placeholder', this.siteDefaultPlaceholder)
			.attr('value', experienceController.siteName());
		siteHelp = section.append('div').classed('help', true);
		
		searchContainer = section.append('div');
			
		this.siteSearchView = new SiteSearchView(searchContainer.node(), 
												 this, experienceController, 
												 this.siteInput.node(), 
												 siteHelp.node());
		
		section = panel2Div.append('section')
			.classed('cell picker offering', true);
				
		this.offeringInput = section.append('input')
			.classed('offering', true)
			.attr('placeholder', this.offeringDefaultPlaceholder)
			.attr('value', experienceController.offeringName());
		offeringHelp = section.append('div').classed('help', true);
			
		searchContainer = section.append('div');
			
		this.offeringSearchView = new OfferingSearchView(searchContainer.node(), 
														 this, experienceController, 
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
				_this.showTags();
				
				if (experienceController.timeframe() == 'Current')
				{
					startDateWheel.onChange();
					currentExperienceButton.classed('pressed', true);
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
				}
				else if (experienceController.timeframe() == 'Goal')
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

		cr.Service.servicesPromise()
			.then(function(services)
				{
					_this.allServices = services;
					var controllers = services.map(function(s) { return new ServiceFlagController(s); });
					_this.tagSearchView.appendFlags(controllers)
						.on('mousedown', function()
							{
								/* Set this variable so that the focusout event of an active 
									tag text box doesn't over-process.
								 */
								_this.inMouseDown = true;
							})
						.on('mouseup', function()
							{
								_this.inMouseDown = false;
							})
						.on('click', function(s)
							{
								if (s.visible === undefined || s.visible)
									_this.tagSearchView.onClickButton(s);
								else
									d3.event.preventDefault();
							});
					
					/* Have to hide after appending the flags or the metrics aren't calculated. */
					_this.tagSearchView.reveal.hide();

					if (_this.experienceController.experienceServices().length == 0)
					{
						var tagInput = _this.appendTag(tagsContainer, null);
						tagInput.node().focus();
					}
					else
					{
						var tagInput = _this.mainDiv.select('.tags-container>input.tag');
						tagInput.node().focus();
					}
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

