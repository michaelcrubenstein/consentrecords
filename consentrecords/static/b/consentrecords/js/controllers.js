var Controller = (function() {
	/* The oldInstance is an instance to be replaced. */
	Controller.prototype._oldInstance = null;
	Controller.prototype._newInstance = null;
	
	Controller.prototype.oldInstance = function(newValue)
	{
		if (newValue === undefined)
			return this._oldInstance;
		else
		{
		    if (newValue != this._oldInstance)
		    {
				this._oldInstance = newValue;
			}
			return this;
		}
	}
	
	Controller.prototype.newInstance = function(newValue)
	{
		if (newValue === undefined)
			return this._newInstance;
		else
		{
		    if (newValue != this._newInstance)
		    {
				this._newInstance = newValue;
			}
			return this;
		}
	}
	
	Controller.prototype.setupPrivilege = function()
		{
			console.assert(false); /* Always override */
		}
		
	/* Append all of the data associated with a new instance. */
	Controller.prototype.appendData = function(initialData)
	{
		this.newInstance().appendData(initialData);
	}
	
	Controller.prototype.getUpdateData = function()
	{
		return this.oldInstance().getUpdateData(this.newInstance());
	}

	Controller.prototype.save = function()
	{
		var _this = this;
	
		if (this.oldInstance())
		{
			var updateData = this.getUpdateData();
			
			if (Object.keys(updateData).length == 0)
			{
				var r2 = $.Deferred();
				r2.resolve(updateData, {});
				return r2;
			}
							
			bootstrap_alert.show($('.alert-container'), this.savingMessage, "alert-info");
			
			return this.oldInstance().update(updateData, false)
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							/* Add any sub elements from the revision to the original. */
							_this.oldInstance().pullElements(_this.newInstance())
									.updateData(changes, newIDs);
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
			bootstrap_alert.show($('.alert-container'), this.addingMessage, "alert-info");

			var initialData = {'add': uuid.v4()};

			this.appendData(initialData);
			this.newInstance().clientID(initialData.add);
			return this.postAdd(initialData)
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							_this.postAddDone(changes, newIDs);
							$(_this.newInstance()).trigger('added.cr');
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
	
	function Controller(instanceType, source)
	{
		if (instanceType)
		{
			this._newInstance = new instanceType();
			if (source)
				source.duplicateData(this._newInstance);
			else
				this._newInstance.setDefaultValues();
			this.setupPrivilege();
		}
	}
	
	return Controller;
})();

var RootController = (function() {
	RootController.prototype = new Controller();
	
	RootController.prototype.setupPrivilege = function()
	{
		this.newInstance().privilege("write");
	}
	
	function RootController(instanceType, source)
	{
		Controller.call(this, instanceType, source);
	}
	
	return RootController;
})();

var ChildController = (function() {
	ChildController.prototype = new Controller();
	ChildController.prototype._parent = null;
	
	Controller.prototype.parent = function(newValue)
	{
		if (newValue === undefined)
			return this._parent;
		else
		{
		    if (newValue != this._parent)
		    {
				this._parent = newValue;
			}
			return this;
		}
	}
	
	ChildController.prototype.setupPrivilege = function()
	{
		this.newInstance().privilege(this._parent.privilege());
	}
	
	function ChildController(parent, instanceType, source)
	{
		this.parent(parent);
		Controller.call(this, instanceType, source);
	}
	
	return ChildController;
})();

var ExperienceController = (function() {
	ExperienceController.prototype = new ChildController();
	
	ExperienceController.prototype.addingMessage = "Adding Experience To Your Pathway...";
	ExperienceController.prototype.savingMessage = "Saving Experience...";
	
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
		return this.newInstance().organizationName();
	}

	ExperienceController.prototype.siteName = function()
	{
		return this.newInstance().siteName();
	}

	ExperienceController.prototype.offeringName = function()
	{
		return this.newInstance().offeringName();
	}

	ExperienceController.prototype.organization = function(newValue)
	{
		var value = this.newInstance().organization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOrganization = function(newValue)
	{
		var value = this.newInstance().customOrganization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.site = function(newValue)
	{
		var value = this.newInstance().site(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customSite = function(newValue)
	{
		var value = this.newInstance().customSite(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.offering = function(newValue)
	{
		var value = this.newInstance().offering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOffering = function(newValue)
	{
		var value = this.newInstance().customOffering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.experienceServices = function(newValue)
	{
		var value = this.newInstance().experienceServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customServices = function(newValue)
	{
		var value = this.newInstance().customServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.start = function(newValue)
	{
		var value = this.newInstance().start(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.end = function(newValue)
	{
		var value = this.newInstance().end(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.timeframe = function(newValue)
	{
		var value = this.newInstance().timeframe(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.clearOrganization = function()
	{
		this.newInstance().organization(null)
						  .site(null)
						  .customOrganization(null)
						  .customSite(null);
		return this;
	}
	
	ExperienceController.prototype.clearSite = function()
	{
		this.newInstance().site(null)
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
		
		this.newInstance().organization(d)
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.sitePicked = function(d)
	{
		if (this.offering() &&
			this.site() &&
			this.site().id() != d.id())
			this.clearOffering();
			
		this.newInstance().site(d)
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.offeringPicked = function(d)
	{
		console.assert(d.site());
		console.assert(d.organization());
		
		this.newInstance().offering(d)
						  .customOffering(null)
						  .site(d.site())
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.clearOffering = function()
	{
		this.newInstance().offering(null)
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
			 .parentID(this.newInstance().id())
			 .service(args);
			this.experienceServices().push(i);
			return i;
		}
		else if (typeof(args) == "string")
		{
			var i = new cr.ExperienceCustomService();
			i.description(args)
			 .parentID(this.newInstance().id())
			 .name(args);
			this.customServices().push(i);
			return i;
		}
		else
			throw new Error("Invalid arguments to addService");
	}
	
	ExperienceController.prototype.removeService = function(service)
	{
		cr.removeElement(this.newInstance().experienceServices(), service);
	}
	
	ExperienceController.prototype.removeCustomService = function(service)
	{
		cr.removeElement(this.newInstance().customServices(), service);
	}
	
	ExperienceController.prototype.distinctExperienceServices = function()
	{
		var existingServices = null;
		if (this.offering() && this.offering().offeringServices())
			existingServices = this.offering().offeringServices()
				.map(function(os) { return os.service(); });
		
		return this.newInstance().experienceServices().filter(
			function(s)
				{
					return !existingServices || 
						   !existingServices.find(function(d) { 
							return s.service().id() == d.id(); 
						});
				});	
	}
	
	ExperienceController.prototype.appendData = function(initialData)
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
					var d = {add: uuid.v4(), position: i++, service: s.service().urlPath()};
					s.clientID(d.add);
					return d;
				});
		if (newServices.length)
		{
			initialData['services'] = newServices;
		}
		
		i = 0;
		var newCustomServices = this.customServices()
			.map(function(s)
				{
					var d = {add: uuid.v4(), position: i, name: s};
					s.clientID(d.add);
					return d;
				});
		if (newCustomServices.length)
		{
			initialData['custom services'] = newCustomServices;
		}
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
		return this.newInstance().getTagList();
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
	
	ExperienceController.prototype.postAdd = function(initialData)
	{
		return this.parent().update({'experiences': [initialData]}, false);
	}
	
	ExperienceController.prototype.postAddDone = function(changes, newIDs)
	{
		this.parent().experiences().push(this.newInstance());
		/* Remove from the experience any experiences that are
			duplicated in the offering services */
		this.newInstance().experienceServices(this.distinctExperienceServices());
		this.newInstance().path(this.parent());
		this.parent().updateData(changes, newIDs);
		return this;
	}

	ExperienceController.prototype.initPreviousDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("{0}-{1}".format(todayDate.getUTCFullYear() - 1, getMonthString(todayDate)));
		this.newInstance().end("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
	}
	
	ExperienceController.prototype.initCurrentDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
		this.newInstance().end("");
	}
	
	ExperienceController.prototype.initGoalDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("");
		this.newInstance().end("");
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
			this.newInstance().experienceServices(services);
		}
		else
		{
			var services = [new cr.ExperienceCustomService()];
			services[0].name(service)
					   .position(0);
			this.newInstance().customServices(services);
		}
		return this;
	}
	
	ExperienceController.prototype.createFromSite = function(d, services)
	{
		this.initPreviousDateRange();
		
		this.organization(d.organization())
			.customOrganization(null)
			.site(d)
			.customSite(null);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
	}

	ExperienceController.prototype.createFromOffering = function(d, services)
	{
		if (!d.organization())
			throw new Error("Runtime Error: Organization is not present in offering record.")
		if (!d.site())
			throw new Error("Runtime Error: Site is not present in offering record.")

		this.initPreviousDateRange();
		
		this.offeringPicked(d);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
	}
	
	ExperienceController.prototype.createFromService = function(d)
	{
		this.initPreviousDateRange();
		
		var service = this.addService(d);
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
	
	function ExperienceController(path, source)
	{
		console.assert(path instanceof cr.Path);
			
		ChildController.call(this, path, cr.Experience, source);
	}
	
	return ExperienceController;
})();

var OrganizationController = (function() {
	OrganizationController.prototype = new RootController();
	
	OrganizationController.prototype.addingMessage = "Adding Organization...";
	OrganizationController.prototype.savingMessage = "Saving Organization...";
	
	OrganizationController.prototype.webSite = function(newValue)
	{
		var value = this.newInstance().webSite(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.inquiryAccessGroup = function(newValue)
	{
		var value = this.newInstance().inquiryAccessGroup(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.names = function(newValue)
	{
		var value = this.newInstance().names(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.groups = function(newValue)
	{
		var value = this.newInstance().groups(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.sites = function(newValue)
	{
		var value = this.newInstance().sites(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.postAdd = function(initialData)
	{
		return cr.IInstance.updateRoots({'organizations': [initialData]});
	}
	
	OrganizationController.prototype.postAddDone = function(changes, newIDs)
	{
		crp.pushInstance(this.newInstance());
		this.newInstance().updateData(changes['organizations'][0], newIDs);
		return this;
	}

	function OrganizationController(source)
	{
		RootController.call(this, cr.Organization, source);
	}
	
	return OrganizationController;
})();

