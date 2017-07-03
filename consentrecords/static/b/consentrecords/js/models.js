var Queue = (function () {

    Queue.prototype.autorun = true;
    Queue.prototype.running = false;
    Queue.prototype.queue = [];

    function Queue(autorun) {
        if (typeof autorun !== "undefined") {
            this.autorun = autorun;
        }
        this.queue = []; //initialize the queue
    };

    Queue.prototype.add = function (callback) {
        var _this = this;
        //add callback to the queue
        this.queue.push(
        	function () {
				var finished = callback();
				if (typeof finished === "undefined" || finished) {
					//  if callback returns `false`, then you have to 
					//  call `next` somewhere in the callback
					_this.dequeue();
				}
        	}
        );

        if (this.autorun && !this.running) {
            // if nothing is running, then start the engines!
            this.dequeue();
        }

        return this; // for chaining fun!
    };

    Queue.prototype.dequeue = function () {
        this.running = false;
        //get the first element off the queue
        var shift = this.queue.shift();
        if (shift) {
            this.running = true;
            shift();
        }
        return shift;
    };

    Queue.prototype.next = Queue.prototype.dequeue;

    return Queue;

})();

var CRP = (function() {
	CRP.prototype.instances = {};	/* keys are ids, values are objects. */
	CRP.prototype.promises = {};	/* keys are paths, values are promises */
	CRP.prototype.fields = {};		/* keys are field ids, values are field data */
	
    function CRP() {
    	this.clear();
    };
    
    CRP.prototype.clear = function() {
    	this.instances = {};
    	this.promises = {};
    	this.fields = {};
    };
    
    /* Get an instance that has been loaded, or undefined if it hasn't been loaded. */
    CRP.prototype.getInstance = function(id)
    {
    	if (!id)
    		throw new Error("id is not defined");
    	if (id in this.instances)
    		return this.instances[id];
    	else
    		return undefined;
    }

	CRP.prototype.pushInstance = function(i)
	{
		if (i.id())
		{
			if (!(i.id() in this.instances))
			{
				this.instances[i.id()] = i;
				return i;
			}
			else
			{
				var oldInstance = this.instances[i.id()];
				return oldInstance.mergeData(i);
			}
		}
		else
			return i;	/* This isn't an object. */
	};
	
	/*
		args has the following fields: path, fields
	 */
	CRP.prototype.promise = function(args)
	{
		if (args.path in this.promises)
			return this.promises[args.path];

		var _this = this;
		
		var promise = cr.getData(args)
			.fail(function(err)
				{
					_this.promises[args.path] = undefined;
					var result = $.Deferred();
					result.reject(err);
					return result.promise();
				});
		this.promises[args.path] = promise;
		return promise;
	}
	
	CRP.prototype.field = function(id)
	{
    	if (!id)
    		throw new Error("id is not defined");
    	if (id in this.fields)
    		return this.fields[id];
    	else
    		return undefined;
	}
	
	CRP.prototype.pushField = function(field)
	{
		if (!field.id)
			throw new Error("field id is not defined");
		if (field.id in this.fields)
			return this.fields[field.id];
		else
		{
			this.fields[field.id] = field;
			return field;
		}
	}
	
	return CRP;
})();

var crp = new CRP();

var cr = {}

cr.fieldNames = {
    /* These names are associated with fields. */
    accessRecord: 'access record',
    accessRequest: 'access request',
    addObjectRule: 'object add rule',
    argument: 'argument',
    configuration: 'configuration',
    booleans: 'boolean',
    canBeAskedAboutExperience: 'can be asked about experience',
    dataType: 'data type',
    defaultAccess: 'default access',
    descriptorType: 'descriptor type',
    email: 'email',
    enumerator: 'enumerator',
    field: 'field',
    firstName: 'first name',
    group: 'group',
    isFresh: 'is fresh',
    lastName: 'last name',
    maxCapacity: 'max capacity',
    name: 'name',
    notification: 'notification',
    ofKind: 'of kind',
    pickObjectPath: 'pick object path',
    privilege: 'privilege',
    publicAccess: 'public access',
    primaryAdministrator: 'primary administrator',
    specialAccess: 'special access',
    systemAccess: 'system access',	/* A special field auto-generated to indicate whether a user has system access. */
    term: 'term',
    text: 'text',
    user: 'user',
    userID: 'userID',
}

cr.descriptorTypes = {
	byText: "by text",
	byFirstText: "by first text",
	byCount: "by count"
}

cr.privileges = {
	find: "find",
	read: "read",
	write: "write",
	administer: "administer",
	register: "register"
}

cr.objectAddRules = {
	pickOne: "pick one",
	createOne: "create one",
	pickOrCreateOne: "pick or create one",
}

cr.specialAccesses = {
	custom: "custom"
}

cr.maxCapacities = {
	uniqueValue: "unique value",
	multipleValues: "multiple values"
}

cr.dataTypes = {
	objectType: "object"
}

cr.booleans = {
	yes: "yes",
	no: "no"
}

cr.ModelObject = (function()
{
	ModelObject.prototype.on = function(events, data, handler)
	{
		if (typeof(events) != "string")
			throw new Error("events is not a string");
		if (typeof(data) != "object")
			throw new Error("data is not an object");
		if (typeof(handler) != "function")
			throw new Error("handler is not a function");
		$(this).on(events, data, handler);
	}

	ModelObject.prototype.one = function(events, data, handler)
	{
		if (typeof(events) != "string")
			throw new Error("events is not a string");
		if (typeof(data) != "object")
			throw new Error("data is not an object");
		if (typeof(handler) != "function")
			throw new Error("handler is not a function");
		$(this).one(events, data, handler);
	}

	ModelObject.prototype.off = function(events, handler)
	{
		$(this).off(events, handler);
	}

	ModelObject.prototype.triggerDataChanged = function(changedValue)
	{
		changedValue = changedValue !== undefined ? changedValue : this;
		$(this).trigger("dataChanged.cr", changedValue);
	}
	
	function ModelObject() {
	};
	
	return ModelObject;
})();
	
cr.Cell = (function() 
	{
		Cell.prototype = new cr.ModelObject();
		Cell.prototype.data = [];
		Cell.prototype.field = null;
		Cell.prototype.parent = null;
		
		Cell.prototype.setParent = function (parent)
		{
			if (parent && !(parent instanceof cr.Instance))
				throw new Error("parent argument is not an instance");
				
			if (this.field.descriptorType !== undefined && this.parent)
			{
				this.off("dataChanged.cr valueAdded.cr valueDeleted.cr", this.parent, this.parent._checkDescription);
			}
			this.parent = parent;
			if (this.field.descriptorType !== undefined && parent)
			{
				this.on("dataChanged.cr valueAdded.cr valueDeleted.cr", parent, parent._checkDescription);
			}
		};

		Cell.prototype.setup = function (parent)
		{
			this.setParent(parent);
	
			/* If this is a unique value and there is no value, set up an unspecified one. */
			if (this.data.length == 0 &&
				this.isUnique()) {
				this.pushValue(this.newValue());
			}
		};

		Cell.prototype.isEmpty = function()
		{
			for (var i = 0; i < this.data.length; ++i)
			{
				if (!this.data[i].isEmpty())
					return false;
			}
			return true;
		};
		
		Cell.prototype.isUnique = function()
		{
			return this.field && this.field.capacity === cr.maxCapacities.uniqueValue;
		}

		Cell.prototype.pushValue = function(newValue)
		{
			newValue.cell = this;		
			this.data.push(newValue);
			newValue.on("dataChanged.cr", this, function(eventObject) {
				eventObject.data.triggerDataChanged();
			});
			newValue.on("valueDeleted.cr", this, function(eventObject) {
				$(eventObject.data).trigger("valueDeleted.cr", newValue);
			});
		};
		
		Cell.prototype.addNewValue = function()
		{
			var newValue = this.newValue();
			this.pushValue(newValue);
			$(this).trigger("valueAdded.cr", newValue);
			return newValue;
		};
		
		/* Returns true if the cell's values need to persist through a delete operation. */
		Cell.prototype.hasPersistentValues = function()
		{
			return this.isUnique();
		}

		Cell.prototype.deleteValue = function(oldData)
		{
			function remove(arr, item) {
				var i = arr.indexOf(item);
				if (i >= 0)
					arr.splice(i, 1);
			  }
			if (this.hasPersistentValues())
			{
				oldData.id = null;
				oldData.clearValue();
			}
			else
			{
				remove(this.data, oldData);
				oldData.cell = undefined;
			}
		};

		/* This method is used to create a new value on the client that has no data. */
		Cell.prototype.newValue = function() {
			throw "newValue must be overwritten by a subclass";
		}
		
		Cell.prototype.replaceValues = function(instances)
		{
			this.data.forEach(function(i)
				{
					i.cell = undefined;
				});
			
			this.data = [];
			var _this = this;
			instances.forEach(function(i)
				{
					_this.pushValue(i);
				});
		}
	
		function Cell(field) {
			this.data = [];
			this.field = field;
		};
		
		return Cell;
	})();
	
cr.StringCell = (function() {
	StringCell.prototype = new cr.Cell();
	
	StringCell.prototype.newValue = function() {
		return new cr.StringValue();
	}
	
	StringCell.prototype.copyValue = function(oldValue) {
		var newValue = new cr.StringValue();
		if (oldValue.id !== null && oldValue.id !== undefined)
			newValue.id = oldValue.id;
		newValue.text = oldValue.text;
		return newValue;
	}
	
	StringCell.prototype.appendData = function(initialData)
	{
		var newData = [];
		$(this.data).each(function()
			{
				if (this.text)
				{
					var newDatum = {text: this.text};
					newData.push(newDatum);
				}
			});
		if (newData.length > 0)
			initialData[this.field.id] = newData;
	}
	
	StringCell.prototype.getAddCommand = function(newValue)
	{
		return {containerUUID: this.parent.getInstanceID(), 
				fieldID: this.field.nameID, 
				text: newValue};
	}
	
	function StringCell(field) {
		cr.Cell.call(this, field);
	}
	
	return StringCell;
})();

cr.TranslationCell = (function() {
	TranslationCell.prototype = new cr.StringCell();
	
	TranslationCell.prototype.newValue = function() {
		return new cr.TranslationValue();
	}
	
	TranslationCell.prototype.copyValue = function(oldValue) {
		var newValue = new cr.TranslationValue();
		if (oldValue.id)
			newValue.id = oldValue.id;
		newValue.text = oldValue.text;
		newValue.languageCode = oldValue.languageCode;
		return newValue;
	}
	
	TranslationCell.prototype.appendData = function(initialData)
	{
		var newData = [];
		$(this.data).each(function()
			{
				if (this.text)
				{
					newData.push({text: this.text, languageCode: this.languageCode});
				}
			});
		if (newData.length > 0)
			initialData[this.field.id] = newData;
	}
	
	TranslationCell.prototype.getAddCommand = function(newValue)
	{
		return {containerUUID: this.parent.getInstanceID(), 
			    fieldID: this.field.nameID, 
			    text: newValue.text, 
			    languageCode: newValue.languageCode};
	}

	function TranslationCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return TranslationCell;
})();
	
cr.NumberCell = (function() {
	NumberCell.prototype = new cr.StringCell();
	
	function NumberCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return NumberCell;
})();
	
cr.EmailCell = (function() {
	EmailCell.prototype = new cr.StringCell();
	
	function EmailCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return EmailCell;
})();
	
cr.UrlCell = (function() {
	UrlCell.prototype = new cr.StringCell();
	
	function UrlCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return UrlCell;
})();
	
cr.TelephoneCell = (function() {
	TelephoneCell.prototype = new cr.StringCell();
	
	function TelephoneCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return TelephoneCell;
})();
	
cr.DatestampCell = (function() {
	DatestampCell.prototype = new cr.StringCell();
	
	function DatestampCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return DatestampCell;
})();
	
cr.DatestampDayOptionalCell = (function() {
	DatestampDayOptionalCell.prototype = new cr.StringCell();
	
	function DatestampDayOptionalCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return DatestampDayOptionalCell;
})();
	
cr.TimeCell = (function() {
	TimeCell.prototype = new cr.StringCell();
	
	function TimeCell(field) {
		cr.StringCell.call(this, field);
	}
	
	return TimeCell;
})();
	
cr.ObjectCell = (function() {
	ObjectCell.prototype = new cr.Cell();
	
	ObjectCell.prototype.newValue = function() {
		return new cr.ObjectValue();
	}
	
	ObjectCell.prototype.copyValue = function(data) {
		var newValue = new cr.ObjectValue();
		newValue.loadData(data);
		newValue.instance(crp.pushInstance(newValue.instance()))
		return newValue;
	}
	
	ObjectCell.prototype.addValue = function(newValue)
	{
		/* Look for an existing item that is empty. If one is found, then change its data. */
		for (var i = 0; i < this.data.length; ++i)
		{
			var oldData = this.data[i];
			if (!oldData.id && oldData.isEmpty()) {
				oldData._completeUpdate(newValue);
				return;
			}
		}
		this.pushValue(newValue);
		$(this).trigger("valueAdded.cr", newValue);
	}

	ObjectCell.prototype.appendData = function(initialData)
	{
		var newData = [];
		if (this.data)
		{
			for (var i = 0; i < this.data.length; ++i)
			{
				var d = this.data[i];
				if (d.getInstanceID())
				{
					/* This case is true if we are picking an object. */
					newData.push({instanceID: d.getInstanceID()});
				}
				else if (d.getCells())
				{
					/* This case is true if we are creating an object */
					var newDatum = {};
					d.getCells().forEach(function(cell)
					{
						cell.appendData(newDatum);
					});
					
					newData.push({cells: newDatum});
				}
				/* Otherwise, it is blank and shouldn't be saved. */
			}
		}
		initialData[this.field.id] = newData;
	}

	ObjectCell.prototype.find = function(value)
	{
		return this.data.find(function(d2)
			{
				return d2.getInstanceID() === value.getInstanceID();
			});
	}
	
	ObjectCell.prototype.getAddCommand = function(newValue)
	{
		/* The description value is used in updateFromChangeData. */
		return {containerUUID: this.parent.getInstanceID(), 
				fieldID: this.field.nameID, 
				instanceID: newValue.getInstanceID(),
				description: newValue.getDescription()};
	}
	
	ObjectCell.prototype.getConfiguration = function()
	{
		return cr.getConfiguration(null, this.field.ofKindID);
	}
		
	function ObjectCell(field) {
		cr.Cell.call(this, field);
	}
	
	return ObjectCell;
})();

cr.Value = (function() {
	Value.prototype = new cr.ModelObject();
	
	Value.prototype.getDescription = function()
	{ 
		throw new Error("getDescription must be overwritten");
	};
	
	Value.prototype.isEmpty = function()
	{
		throw new Error("isEmpty must be overwritten");
	}
	
	Value.prototype.clearValue = function()
	{
		throw new Error("clearValue must be overwritten");
	};
	
	Value.prototype.updateFromChangeData = function()
	{
		throw new Error("updateFromChangeData must be overwritten");
	};
	
	Value.prototype.triggerDeleteValue = function()
	{
		/* Delete from the cell first, so that other objects know the cell may be empty. */
		if (this.cell)
		    this.cell.deleteValue(this);
		$(this).trigger("valueDeleted.cr", this);
	}
	
	Value.prototype.deleteValue = function()
	{
		var _this = this;
		if (this.id == null)	/* It was never saved */
		{
			_this.triggerDeleteValue();
			var r = $.Deferred();
			r.resolve(_this);
			return r;
		}
		else
		{
			return $.ajax({
					url: cr.urls.getData + "value/" + this.id + "/",
					type: 'DELETE',
				})
				.then(function()
					{
						_this.triggerDeleteValue();
						return _this;
					},
					cr.thenFail);
		}
	};
	
	Value.prototype.appendDeleteCommand = function(initialData, sourceObjects)
	{
		initialData.push({id: this.id});
		sourceObjects.push(this);
	}
	
	Value.prototype.update = function(newValueID, initialData, done)
	{
		this.id = newValueID;

		this.updateFromChangeData(initialData);

		if (done)
			done();

		this.triggerDataChanged();
	}
			
	function Value() {
		this.id = null; 
		this.cell = null;	/* Initialize the container cell to empty. */
	};
	
	return Value;
})();
	
cr.StringValue = (function() {
	StringValue.prototype = new cr.Value();

	StringValue.prototype.getDescription = function() { return this.text; };
	
	StringValue.prototype.isEmpty = function()
	{
		return this.text === null || this.text === undefined || this.text === "";
	}
	StringValue.prototype.clearValue = function() { this.text = null; }

	StringValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		if (newValue === "")
			newValue = null;
			
		/* If both are null, then they are equal. */
		if (!newValue && !this.text)
			newValue = this.text;
		
		var command;
		if (newValue != this.text)
		{
			if (this.id)
			{
				if (newValue)
					command = {id: this.id, text: newValue}
				else
					command = {id: this.id}	/* No value, so delete this item. */
			}
			else
			{
				command = this.cell.getAddCommand(newValue);
				command.index = i;
			}
			initialData.push(command);
			sourceObjects.push(this);
		}
	}
	
	StringValue.prototype.updateFromChangeData = function(changeData)
	{
		this.text = changeData.text;
	}

	function StringValue() {
		cr.Value.call(this);
	}
	
	return StringValue;
})();
	
cr.TranslationValue = (function() {
	TranslationValue.prototype = new cr.StringValue();
	
	TranslationValue.prototype.clearValue = function() { this.text = null; this.languageCode = null; }

	TranslationValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		if (newValue.text === "")
			newValue.text = null;
			
		/* If both are null, then they are equal. */
		if (!newValue.text && !this.text)
			newValue.text = this.text;
		
		if (newValue.text !== this.text || 
			newValue.languageCode !== this.languageCode)
		{
			var command;
			if (this.id)
			{
				if (newValue.text)
					command = {id: this.id, text: newValue.text, languageCode: newValue.languageCode};
				else
					command = {id: this.id}; /* No value, so delete the command. */
			}
			else
			{
				command = this.cell.getAddCommand(newValue);
				command.index = i;
			}
			initialData.push(command);
			sourceObjects.push(this);
		}
	}

	TranslationValue.prototype.updateFromChangeData = function(changeData)
	{
		this.text = changeData.text;
		this.languageCode = changeData.languageCode;
	}

	function TranslationValue() {
		cr.StringValue.call(this);
		this.text = null;
		this.languageCode = null;
	};
	
	return TranslationValue;
})();

cr.Instance = (function() {
	Instance.prototype = new cr.ModelObject();
	Instance.prototype._instanceID = null;
	Instance.prototype._description = "None";
	Instance.prototype._typeName = null;
	Instance.prototype._privilege = null;
	Instance.prototype._cells = null;
	Instance.prototype._parentID = null;
	
	Instance.prototype.getDescription = function() 
	{ 
		return this._description;
	};
	
	Instance.prototype.setDescription = function(newDescription)
	{
		this._description = newDescription || "None";
		return this;
	}
	
	Instance.prototype.getInstanceID = function()
	{
		return this._instanceID;
	};
	
	Instance.prototype.setInstanceID = function(instanceID)
	{
		this._instanceID = instanceID;
		return this;
	}
	
	Instance.prototype.getTypeName = function()
	{
		return this._typeName;
	}
	
	Instance.prototype.setTypeName = function(typeName)
	{
		this._typeName = typeName;
		return this;
	}
	
	Instance.prototype.getPrivilege = function()
	{
		return this._privilege;
	}
	
	Instance.prototype.setPrivilege = function(privilege)
	{
		this._privilege = privilege;
		return this;
	}
	
	Instance.prototype.getCells = function()
	{
		return this._cells;
	}
	
	/** Returns true if the cells of this instance are loaded. Otherwise, returns false.
	 * If fields are specified, then, in order to return true, each of the instances referenced
	 * in each specified field must also have all of its cells loaded.
	 */
	Instance.prototype.areCellsLoaded = function(fields)
	{
		if (this._cells === null)
			return false;
		
		if (fields)
		{
			for (var i = 0; i < fields.length; ++i)
			{
				var fieldName = fields[i];
				var cell = this.getCell(fieldName);
				if (cell)
				{
					var datum = cell.data.find(function(d) { return d.getInstanceID() && !d.instance()._cells; });
					if (datum)
						return false;
				}
			}
		}
		
		return true;
	}

	Instance.prototype.setCells = function(cells)
	{
		this._cells = cells;
		var _this = this;
		cells.forEach(function(cell) {
			cell.setParent(_this);
		});
		return this;
	}
	
	/** if parentID is undefined, returns the parent of this instance. The parent off
	 * an instance is the instance that, when deleted, will automatically delete this instance.
	 *
	 * If parentID is defined, then set the parentID of this instance and return this so that
	 * subsequent operations can be chained.
	 */
	Instance.prototype.parent = function(parentID)
	{
		if (parentID === undefined)
			return this._parentID && crp.getInstance(this._parentID);
		else
		{
			this._parentID = parentID;
			return this;
		}
	}
	
	Instance.prototype.updateFromChangeData = function(changeData)
	{
		/* Replace the value completely so that its cells are eliminated and will be
			re-accessed from the server. This handles the case where a value has been added. */
		if (!changeData.instanceID)
			throw new Error("instanceID is not specified.");
		this._instanceID = changeData.instanceID;
		this.setDescription(changeData.description);
		this._cells = null;
	}
	
	Instance.prototype.isEmpty = function()
	{
		return !this.getInstanceID() && !this.getCells();
	}

	Instance.prototype.clearValue = function()
	{
		this._instanceID = null; 
		this._description="None";
		this._privilege = null;
		this._cells = null;
	}
	
	Instance.prototype.calculateDescription = function()
	{
		if (!this.getCells())
		{
			if (!this.getDescription())
				this.setDescription("None");
		}
		else
		{
			var nameArray = [];
			this.getCells().forEach(function(cell)
			{
				if (cell.field.descriptorType == cr.descriptorTypes.byText)
				{
					var cellNames = cell.data.filter(function (d) { return !d.isEmpty(); })
						.map(function (d) { return d.getDescription(); });
					if (cellNames.length > 0)
						nameArray.push(cellNames.join(separator=' '));
				}
				else if (cell.field.descriptorType == cr.descriptorTypes.byFirstText)
				{
					var cellNames = cell.data.filter(function (d) { return !d.isEmpty(); })
						.map(function (d) { return d.getDescription(); });
					if (cellNames.length > 0)
						nameArray.push(cellNames[0]);
				}
				else if (cell.field.descriptorType == cr.descriptorTypes.byCount)
				{
					nameArray.push(cell.data.length.toString());
				}
			});
			this.setDescription(nameArray.length ? nameArray.join(separator = ' ') : "None");
		}
	}

	Instance.prototype.hasTextDescription = function()
	{
		var cells = this.getCells();
		for (var i = 0; i < cells; ++i)
		{
			var cell = cells[i];
			if ((cell.field.descriptorType == cr.descriptorTypes.byText ||
			     cell.field.descriptorType == cr.descriptorTypes.byFirstText) &&
				cell.data.length > 0)
				return true;
		}
		return false;
	}

	Instance.prototype.getCell = function(name)
	{
		if (!name)
			throw new Error("name argument of getCell unspecified");
			
		if (this.getCells())
			return this.getCells().find(function(cell)
				{
					return cell.field.name == name;
				});
		else
			return undefined;
	}

	Instance.prototype.getDatum = function(name)
	{
		var cell = this.getCell(name);
		return cell && cell.data.length && cell.data[0].text;
	}
		
	Instance.prototype.getValue = function(name)
	{
		var cell = this.getCell(name);
		return cell && cell.data.length && cell.data[0];
	}
	
	Instance.prototype.getNonNullValue = function(name)
	{
		var d = this.getValue(name);
		if (d && d.getInstanceID())
			return d;
		else
			return undefined;
	}
	
	Instance.prototype.importCell = function(oldCell)
	{
		var newCell = cr.createCell(oldCell.field);
		if (oldCell.data)
		{
			$(oldCell.data).each(function()
			{
				var newValue = newCell.copyValue(this);
				newCell.pushValue(newValue);
			});
		}
		newCell.setup(this);
		this.getCells().push(newCell);
		return newCell;
	}

	/** Import all of the cells from oldCells into the cells of this instance.
	 */
	Instance.prototype.importCells = function(cells)
	{
		if (!cells)
			throw new Error("Runtime Error: argument of cells to import is null");
			
		this._cells = [];
		for (var i = 0, len = cells.length; len > 0; ++i, --len)
			this.importCell(cells[i]);
	}

	/* loadData loads the data from the middle tier or another ObjectValue. */
	Instance.prototype.loadData = function(data)
	{
		this.setInstanceID(data._instanceID || data.instanceID || null);
		this._parentID = data._parentID || data.parentID || null;
		this.setDescription(data._description || data.description || null);
		this.setPrivilege(data._privilege || data.privilege || null);
		this.setTypeName(data._typeName || data.typeName || null);
		
		if (data.getCells)
		{
			if (data.getCells())
			{
				this.importCells(data.getCells());
			}
		}	
		else if (data.cells)
		{
			this.importCells(data.cells);
		}
	}

	/* Import the data associated with this object from the middle tier. */
	Instance.prototype.importData = function(data)
	{
		this.importCells(data.cells);
		this.setPrivilege(data.privilege);
		if (data.typeName)
			this.setTypeName(data.typeName);
	}

	Instance.prototype._handleContentsChanged = function(changedValue)
	{
		var oldDescription = this.getDescription();
		this.calculateDescription();
		if (this.getDescription() != oldDescription)
			this.triggerDataChanged(changedValue);
	}
	
	/* this method is attached to a cell when its contents are changed. */
	Instance.prototype._checkDescription = function(eventObject, changedValue)
	{
		eventObject.data._handleContentsChanged(changedValue);
	}
	
	Instance.prototype.promiseParent = function()
	{
		if (this.getPrivilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.getDescription()));
			return result.promise();
		}
		
		var _this = this;
		
		if (!this._parentID)
		{
			var result = $.Deferred();
			result.resolve(null);
			return result.promise();
		}
		if (this.parent())
		{
			var result = $.Deferred();
			result.resolve(this.parent());
			return result.promise();
		}
		
		return cr.getData({ "path" : this.getInstanceID() })
			.done(function(values)
				{
					var result = $.Deferred();
					result.resolve(values[0].instance());
					return result.promise();
				});
	}

	Instance.prototype.promiseCells = function(fields)
	{
		if (this.getPrivilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.getDescription()));
			return result.promise();
		}
		
		var _this = this;
		function fieldsLoaded(fields)
		{
			if (_this.getCells().find(function(cell)
				{
					if (!fields || fields.indexOf(cell.field.name) < 0)
						return false;
					if (cell.data.find(function(d)
						{
							return d.getInstanceID() && !d.areCellsLoaded();
						}))
						return true;
				}))
				return false;
			if (fields && fields.indexOf("parents") >= 0)
			{
				if (!_this.getCells().find(function(cell)
					{
						return cell.field.name == _this.parent().getTypeName();
					}))
					return false;
			}
			return true;
		}
	
		if (this.getCells() && this.areCellsLoaded() && fieldsLoaded(fields))
		{
			var result = $.Deferred();
			result.resolve(this.getCells());
			return result.promise();
		}
		else if (this.getInstanceID())
		{
			var jsonArray = {};
			if (fields)
				jsonArray["fields"] = JSON.stringify(fields.filter(function(s) { return s.indexOf("/") < 0; }));
			return $.getJSON(cr.urls.getData + this.getInstanceID() + "/", jsonArray)
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							if (json.fields)
							{
								json.fields.forEach(function(field)
									{
										crp.pushField(field);
									});
							}
							/* If the data length is 0, then this item can not be read. */
							if (json.data.length > 0)
							{
								_this.importData(json.data[0]);
							}
							else
							{
								_this.importCells([]);
								_this.setPrivilege(null);
							}
							
							r2.resolve(_this.getCells());
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 )
				.then(function(cells)
					{
						if (!fields)
							return;
							
						var subFields = fields.filter(function(s) { return s.indexOf("/") >= 0; });
						if (subFields.length == 0)
							return;
						try
						{
							return $.when.apply(null, subFields.map(
									function(s) {
										var cellName = s.substring(0, s.indexOf("/"));
										var fieldNames = s.substring(s.indexOf("/") + 1).split(",");
										try
										{
											return cr.getCellValues(_this, cellName, fieldNames); 
										}
										catch(err)
										{
											var r3 = $.Deferred();
											r3.reject(err);
											return r3;
										}
									}))
								.then(function()
									{
										var r3 = $.Deferred();
										r3.resolve(cells);
										return r3;
									},
									function(err)
									{
										var r3 = $.Deferred();
										r3.reject(err);
										return r3;
									});
						}
						catch(err)
						{
							var r3 = $.Deferred();
							r3.reject(err);
							return r3;
						}
					}
				);
		}
		else if (this.cell.field.ofKindID)
		{
			var _this = this;
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			return cr.getConfiguration(this, this.getTypeName())
				.done(function(newCells)
					{
						_this.setCells(newCells);
					});
		}
	}
	
	Instance.prototype.promiseCellsFromCache = function(fields)
	{
		var storedI = crp.getInstance(this.getInstanceID());
		if (storedI && storedI.areCellsLoaded(fields))
		{
			if (this !== storedI)
			{
				this.importCells(storedI.getCells());
			}
			var result = $.Deferred();
			result.resolve(this.getCells());
			return result.promise();
		}
		else 
			return this.promiseCells(fields);
	}
	
	function Instance() {
	};
	
	return Instance;

})();
	
cr.ObjectValue = (function() {
	ObjectValue.prototype = new cr.Value();
	ObjectValue.prototype._instance = null;
	ObjectValue.prototype._instanceDataChanged = null;
	
	ObjectValue.prototype.instance = function(instance)
	{
		if (instance === undefined)
			return this._instance;
		else
		{
			if (this._instance)
			{
				this._instance.off("dataChanged.cr", this._instanceDataChanged);
			}
			
			this._instance = instance;
			var _this = this;
			this._instanceDataChanged = function(eventObject, newValue)
			{
				$(eventObject.data).trigger("dataChanged.cr", newValue == this ? eventObject.data : newValue);
			}
			this._instance.on("dataChanged.cr", this, this._instanceDataChanged);
			return this;
		}
	}
	
	ObjectValue.prototype.getDescription = function() 
	{ 
		return this._instance ? this._instance.getDescription() : "None";
	};
	
	ObjectValue.prototype.setDescription = function(description)
	{
		this._instance.setDescription(description);
		return this;
	}
	
	ObjectValue.prototype.getInstanceID = function()
	{
		return this._instance && this._instance.getInstanceID();
	};
	
	ObjectValue.prototype.setInstanceID = function(instanceID)
	{
		this._instance.setInstanceID(instanceID);
		return this;
	}
	
	ObjectValue.prototype.getTypeName = function()
	{
		return this._instance.getTypeName();
	}
	
	ObjectValue.prototype.setTypeName = function(typeName)
	{
		this._instance.setTypeName(typeName);
		return this;
	}
	
	ObjectValue.prototype.getPrivilege = function()
	{
		return this._instance.getPrivilege();
	}
	
	ObjectValue.prototype.setPrivilege = function(privilege)
	{
		this._instance.setPrivilege(privilege);
		return this;
	}
	
	ObjectValue.prototype.getCells = function()
	{
		return this._instance && this._instance.getCells();
	}
	
	ObjectValue.prototype.areCellsLoaded = function(fields)
	{
		return this._instance.areCellsLoaded(fields);
	}

	ObjectValue.prototype.setCells = function(oldCells)
	{
		this._instance.setCells(oldCells);
		return this;
	}
	
	ObjectValue.prototype.appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
	{
		var newInstanceID = (newValue ? newValue.getInstanceID() : null);
		var newDescription = (newValue ? newValue.getDescription() : null);

		/* If both are null, then they are equal. */
		if (!newInstanceID && !this.getInstanceID())
			return;
		
		var command;
		if (!newInstanceID)
		{
			if (this.getInstanceID())
				this.appendDeleteCommand(initialData, sourceObjects);
		}
		else {
			if (this.getInstanceID() == newInstanceID)
				return;
			if (this.id)
			{
				command = {id: this.id, instanceID: newInstanceID, description: newDescription};
				if (newValue.areCellsLoaded())
				{
					var _this = this;
					sourceObjects.push({target: this, update: function()
						{
							_this.instance(newValue.instance());
						}});
				}
				else
					sourceObjects.push(this);
			}
			else
			{
				command = this.cell.getAddCommand(newValue);
				if (i >= 0)
					command.index = i;
				if (newValue.areCellsLoaded())
				{
					var _this = this;
					sourceObjects.push({target: this, update: function()
						{
							_this.importCells(newValue.getCells());
						}});
				}
				else
					sourceObjects.push(this);
			}
			initialData.push(command);
		}
		
	}

	ObjectValue.prototype.updateFromChangeData = function(changeData)
	{
		if (changeData.instanceID && crp.getInstance(changeData.instanceID))
			this.instance(crp.getInstance(changeData.instanceID));
		else
		{
			var instance = new cr.Instance();
			instance.loadData(changeData);
			this.instance(crp.pushInstance(instance));
		}
	}
	
	ObjectValue.prototype._completeUpdate = function(newValue)
	{
		this.id = newValue.id;
		this.instance(newValue.instance());
		this.triggerDataChanged();
	}

	ObjectValue.prototype.deleteValue = function()
	{
		var _this = this;
		if (this.cell != null &&
			this.getInstanceID() != null &&
			this.instance().parent() == this.cell.parent)
		{
			/* In this case, this is a root object, so we just need to 
				delete the instance. */
			return $.ajax({
					url: cr.urls.getData + this.getInstanceID() + "/",
					type: 'DELETE',
				})
				.then(function()
					{
						_this.triggerDeleteValue();
						return _this;
					},
					cr.thenFail);
		}
		else
			return cr.Value.prototype.deleteValue.call(this);
	};
	
	ObjectValue.prototype.isEmpty = function()
	{
		return !this._instance || this._instance.isEmpty();
	}

	ObjectValue.prototype.clearValue = function()
	{
		if (this._instance)
		{
			this._instance.off("dataChanged.cr", this._instanceDataChanged);
			this._instanceDataChanged = null;
			this._instance = null;
		}
		this.instance(new cr.Instance());
	}
	
	ObjectValue.prototype.calculateDescription = function()
	{
		this._instance.calculateDescription();
	}

	ObjectValue.prototype.hasTextDescription = function()
	{
		return this._instance && this._instance.hasTextDescription();
	}

	ObjectValue.prototype.getCell = function(name)
	{
		return this._instance && this._instance.getCell(name);
	}

	ObjectValue.prototype.getDatum = function(name)
	{
		return this._instance && this._instance.getDatum(name);
	}
		
	ObjectValue.prototype.getValue = function(name)
	{
		return this._instance && this._instance.getValue(name);
	}
	
	ObjectValue.prototype.getNonNullValue = function(name)
	{
		return this._instance && this._instance.getNonNullValue(name);
	}
		
	ObjectValue.prototype.importCell = function(cell)
	{
		this._instance.importCell(cell);
	}

	ObjectValue.prototype.importCells = function(cells)
	{
		if (!this.instance())
			throw new Error("instance has not been instantiated.");
			
		this._instance.importCells(cells);
	}

	/* loadData loads the data from the middle tier or another ObjectValue. */
	ObjectValue.prototype.loadData = function(data)
	{
		if (data.id)
			this.id = data.id;
		
		if (data.instance && data.instance())
		{
			if (this._instance)
				this._instance.off("dataChanged.cr", this._instanceDataChanged);
			this.instance(data.instance());
		}
		else
		{
			if (!this.instance())
				this.instance(new cr.Instance());
			this.instance().loadData(data);
		}
	}

	/* Save a new version of this object.
		This is called when a object is instantiated on the client as an empty object
		and its data is being filled here.
	 */
	ObjectValue.prototype.saveNew = function(initialData, done, fail)
	{
		var containerCell = this.cell;
		var containerUUID = containerCell.parent ? containerCell.parent.getInstanceID() : null;
			
		var _this = this;
		return $.when(cr.createInstance(containerCell.field, containerUUID, initialData))
		        .then(function(newValue)
		        	{
		        		_this._completeUpdate(newValue);
		        	});
	}
	
	/* Import the data associated with this object from the middle tier. */
	ObjectValue.prototype.importData = function(data)
	{
		this._instance.importData(data);
	}

	ObjectValue.prototype.promiseCells = function(fields)
	{
		return this._instance.promiseCells(fields);
	}
	
	ObjectValue.prototype.promiseCellsFromCache = function(fields)
	{
		return this._instance.promiseCellsFromCache(fields);
	}
	
	ObjectValue.prototype.checkConfiguration = function(done, fail)
	{
		if (!fail)
			throw ("fail is not specified");
		if (!done)
			throw ("done is not specified");
		if (!this.cell)
			throw "cell is not specified for this object";
		
		if (this.getCells())
		{
			done(this.getCells());
		}
		else
		{
			/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
			var _this = this;
			this.cell.getConfiguration()
				.then(function(newCells)
					{
						_this.setCells(newCells);
						done(newCells);
					},
					fail);
		}
	}
	
	ObjectValue.prototype.canWrite = function()
	{
		if (this.getInstanceID() === null)
			throw(this.getDescription() + " has not been saved");
			
		return [cr.privileges.write, cr.privileges.administer].indexOf(this.getPrivilege()) >= 0;
	}
	
	function ObjectValue() {
		cr.Value.call(this);
	};
	
	return ObjectValue;
})();

cr.cellFactory = {
	string: cr.StringCell,
	number: cr.NumberCell,
	email: cr.EmailCell,
	url: cr.UrlCell,
	telephone: cr.TelephoneCell,
	translation: cr.TranslationCell, 
	datestamp: cr.DatestampCell, 
	"datestamp (day optional)": cr.DatestampDayOptionalCell,
	time: cr.TimeCell,
	object: cr.ObjectCell
}
	
cr.createCell = function(fieldID) {
	var field;
	if (typeof(fieldID) == "string")
		field = crp.field(fieldID);
	else if ('id' in fieldID)
		field = crp.field(fieldID.id);
	else
		field = null;
		
	if (!field)
		throw new Error("fieldID is not recognized: {0}".format(fieldID));
		
	var f = cr.cellFactory[field.dataType];
	return new f(field);
};
	
cr.urls = {
		getUserID : "/api/getuserid/",
		getData : "/api/",
		updateValues : "/api/updatevalues/",
		checkUnusedEmail : '/user/checkunusedemail/',
		submitSignout: '/user/submitsignout/',
		submitSignin: '/submitsignin/',
		submitNewUser: '/submitnewuser/',
		updateUsername: '/user/updateusername/',
		updatePassword: '/user/updatepassword/',
		acceptFollower: '/user/acceptFollower/',
		requestAccess: '/user/requestAccess/',
		resetPassword: '/user/resetpassword/',
		requestExperienceComment: '/user/requestExperienceComment/',
		log: '/monitor/log/',
	};
	
cr.accessToken = null;
cr.refreshToken = null;
cr.tokenType = null;
	
cr.postError = function(jqXHR, textStatus, errorThrown)
	{
		if (jqXHR.status == 504 || textStatus == "timeout")
			return "This operation ran out of time.";
		else if (jqXHR.status == 403)
			return "Your web page is out of date. You may be able to solve this by reloading the web page.";
		else if (jqXHR.status == 0)
			return "The server is not responding. Please try again.";
		else
			return jqXHR.statusText;
	};

cr.postFailed = function(jqXHR, textStatus, errorThrown, failFunction)
	{
		failFunction(new Error(cr.postError(jqXHR, textStatus, errorThrown)));
	};

cr.thenFail = function(jqXHR, textStatus, errorThrown)
	{
		var r2 = $.Deferred();
		r2.reject(new Error(cr.postError(jqXHR, textStatus, errorThrown)));
		return r2;
	};
	
cr.updateObjectValue = function(oldValue, d, i, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		/* oldValue must be an object value */
		var initialData = [];
		var sourceObjects = [];
		oldValue.appendUpdateCommands(i, d, initialData, sourceObjects);
		$.post(cr.urls.updateValues, 
				{ commands: JSON.stringify(initialData)
				})
			  .done(function(json, textStatus, jqXHR)
				{
					oldValue.id = json.valueIDs[0];
					oldValue.instance(d.instance());
					oldValue.triggerDataChanged();
					successFunction();
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	};
	
cr.deleteValue = function(valueID, successFunction, failFunction)
	{
		return $.ajax({
				url: cr.urls.getData + "value/" + valueID + "/",
				type: 'DELETE',
			})
			.then(undefined,
			cr.thenFail);
	};
			
cr.createInstance = function(field, containerUUID, initialData)
	{
		var jsonArray = {
					properties: JSON.stringify(initialData)
				};
		if (field.nameID)
			jsonArray.elementUUID = field.nameID;
		else if (field.name)
			jsonArray.elementName = field.name;
		else
			throw ("neither field name nor field name ID is specified");
			
		if (field.ofKindID)
			jsonArray.typeID = field.ofKindID;
		else if (field.ofKind)
			jsonArray.typeName = field.ofKind;
		else
			throw ("neither field.ofKindID nor field.ofKind is specified");
		
		var url;	
		if (containerUUID)
			url = cr.urls.getData + containerUUID + "/";
		else
			url = cr.urls.getData;
	
		return $.post(url, jsonArray)
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							var newValue = cr.ObjectCell.prototype.copyValue(json.object);							
							r2.resolve(newValue);
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 );
	},
	
cr.updateValues = function(initialData, sourceObjects)
	{
		return $.post(cr.urls.updateValues, 
			{ commands: JSON.stringify(initialData)
			})
			.then(function(json)
				{
					var r2 = $.Deferred();
					try
					{
						for (var i = 0; i < sourceObjects.length; ++i)
						{
							var d;
							var update;
							if (sourceObjects[i].hasOwnProperty("target"))
							{
								d = sourceObjects[i].target;
								update = sourceObjects[i].update;
							}
							else
							{
								d = sourceObjects[i];
								update = null;
							}
							var newValueID = json.valueIDs[i];
							var newInstanceID = json.instanceIDs[i];

							/* Check to see if d is a cell instead of a value. If so, then
								change it to a newly created value. 
							 */
							if ("addNewValue" in d)
							{
								d = d.addNewValue();
							}
					
							if (newValueID)
							{
								/* Object Values have an instance ID as well. */
								if (newInstanceID)
									initialData[i].instanceID = newInstanceID;
							
								d.update(newValueID, initialData[i], update);
							}
							else
							{
								d.triggerDeleteValue();
							}
						}
						r2.resolve();
					}
					catch (err)
					{
						r2.reject(err);
					}
					return r2;
				},
				cr.thenFail);
	},
	
cr.getUserID = function(successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.getJSON(cr.urls.getUserID,
			{"access_token": cr.accessToken})
		.done(function(json)
			{
				successFunction(json.userID);
			})
		.fail(function(jqXHR, textStatus, errorThrown)
			{
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			}
		);
	},

cr.getFieldData = function(field)
{
	var nameValue = field.getValue(cr.fieldNames.name);
	var dataTypeValue = field.getValue(cr.fieldNames.dataType);
	var fieldData = {};
	
	fieldData.id = field.getInstanceID();
	fieldData.name = nameValue.getDescription();
	fieldData.nameID = nameValue.getInstanceID();
	fieldData.dataType = dataTypeValue.getDescription();
	fieldData.dataTypeID = dataTypeValue.getInstanceID();
	
	var maxCapacity = field.getValue(cr.fieldNames.maxCapacity);
	fieldData.capacity = maxCapacity ? maxCapacity.getDescription() : cr.maxCapacities.multipleValues;
	
	var descriptorTypeField = field.getValue(cr.fieldNames.descriptorType);
	if (descriptorTypeField)
		fieldData.descriptorType = descriptorTypeField.getDescription();
	
	var addObjectRuleField = field.getValue(cr.fieldNames.addObjectRule);
	if (addObjectRuleField)
		fieldData.objectAddRule = addObjectRuleField.getDescription();
	
	if (fieldData.dataType == cr.dataTypes.objectType)
	{
		var ofKindField = field.getValue(cr.fieldNames.ofKind);
		if (ofKindField)
		{
			fieldData.ofKind = ofKindField.getDescription();
			fieldData.ofKindID = ofKindField.getInstanceID();
		}
		
		var pickObjectPath = field.getDatum(cr.fieldNames.pickObjectPath);
		if (pickObjectPath)
			fieldData.pickObjectPath = pickObjectPath;
	}
	
	return fieldData;
}

cr.getConfiguration = function(parent, typeID)
	{
		var data;
		var path;
		
		if (/^[A-Za-z0-9]{32}$/.test(typeID))
			path = typeID+'/configuration';
		else
			path = 'term[name={0}]/configuration'.format(typeID);
		return crp.promise({path:path, fields: ['field']})
			.then(function(configurations)
				{
					var configuration = configurations[0];
					var cells = [];
					configuration.getCell(cr.fieldNames.field).data.forEach(function(field)
					{
						crp.pushField(cr.getFieldData(field));
						var newCell = cr.createCell(field.getInstanceID());
						newCell.setup(parent);
						cells.push(newCell);
					});
					var r = $.Deferred();
					r.resolve(cells);
					return r;
				});
	},
	
	
/* 
	args is an object with up to four parameters: path, fields, done, fail
 */
cr.getData = function(args)
	{
		if (!args.path)
			throw new Error("path is not specified to getData");
		if (!args.resultType)
		    throw new Error("resultType is not specified to getData");
		
		var data = {};
		if (args.fields)
			data['fields'] = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.getData + args.path + "/", data)
			.then(function(json)
				{
					try
					{
						return json.data.map(function(d)
							{
								var i = new args.resultType();
								i.setData(d);
								if (i.canCache())
									return crp.pushInstance(i);
								else
									return i;
							});
					}
					catch(err)
					{
						var result = $.Deferred();
						result.reject(err);
						return result;
					}
				},
				cr.thenFail);
	}

/* Loads all of the elements of the specified cell within the specified object.
	If the cellName is the name of an objectCell, fieldNames determines the sub-cells that
	are also loaded at the same time.
 */
cr.getCellValues = function(object, cellName, fieldNames)
	{
		var path = '{0}/{1}'.format(object.getInstanceID(), cellName);
		return cr.getData({path: path, fields: fieldNames})
			.then(function(instances)
				{
					var cell = object.getCell(cellName);
					cell.replaceValues(instances);
				},
				function(err)
				{
					r3 = $.Deferred();
					r3.reject(err);
					return r3;
				});
	}

cr.submitSignout = function()
	{
		return $.post(cr.urls.submitSignout, { })
			.then(function(json) {
					crp.clear();
				},
				cr.thenFail)
			.promise();
	}

cr.updateUsername = function(newUsername, password)
	{
		return $.post(cr.urls.updateUsername, {newUsername: newUsername, 
										password: password})
		        .then(function(json)
				{
					var v = cr.signedinUser.getValue(cr.fieldNames.email);
					v.updateFromChangeData({text: newUsername});
					v.triggerDataChanged();
				},
				cr.thenFail);
	}
	
cr.updatePassword = function(username, oldPassword, newPassword)
	{
		return $.post(cr.urls.updatePassword, {username: username,
										oldPassword: oldPassword,
										newPassword: newPassword })
				.fail(cr.thenFail);
	}

cr.share = function(userPath, path, privilegeID, done, fail)
	{
		var url = cr.urls.acceptFollower;
		if (userPath)
			url += userPath + "/";
		$.post(url, {follower: path,
					 privilege: privilegeID
					})
		.done(function(json){
				/* Copy the data from json object into a new value so that 
					any functions are properly initialized.
				 */
				var newValue = new cr.ObjectValue();
				newValue.loadData(json.object);
				done(newValue);
		})
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
	}

cr.requestAccess = function(follower, followingPath, done, fail)
{
		$.post(cr.urls.requestAccess, {follower: follower.getInstanceID(),
									   following: followingPath
					  				  })
		.done(done)
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
}

cr.requestExperienceComment = function(experience, followerPath, question)
	{
		var jsonArray = {experience: experience.getInstanceID(),
			path: followerPath.getInstanceID(),
			question: question};
	
		return $.when($.post(cr.urls.requestExperienceComment, jsonArray))
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							json.fields.forEach(function(field)
								{
									crp.pushField(field);
								});
							/* Copy the data from json object into newData so that 
								any functions are properly initialized.
							 */
							var newData;
							if (json.Comments)
							{
								var newComments = cr.ObjectCell.prototype.copyValue(json.Comments);
								var commentsCell = experience.getCell('Comments');
								
								var commentsValue = null;
								for (var i = 0; i < commentsCell.data.length; ++i)
								{
									var oldData = commentsCell.data[i];
									if (!oldData.id && oldData.isEmpty()) {
										if (oldData.instance())
											throw new Error("Assert failed: old comments has instance");
										oldData.id = newComments.id;
										oldData.instance(newComments.instance());
										commentsValue = oldData;
										break;
									}
								}
								if (!commentsValue)
								{
									commentsCell.pushValue(newComments);
									commentsValue = newComments;
								}

								$(commentsValue).trigger('dataChanged.cr', commentsValue);
								newData = commentsValue.getValue('Comment');
							}
							else
							{
								newData = cr.ObjectCell.prototype.copyValue(json.Comment);
								var comments = experience.getValue('Comments');
								commentCell = comments.getCell('Comment');
								commentCell.addValue(newData);
							}
														
							r2.resolve(newData);
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 );
	},
	
cr._logQueue = new Queue(true)
cr.logRecord = function(name, message)
	{
		cr._logQueue.add(function()
		{
			/* This message is silent and does not record errors. */
			message = message !== undefined ? message : 'None';
			$.post(cr.urls.log,
				   {name: name, message: message })
			.done(function() {cr._logQueue.dequeue()});
			return false;
		});
	}

cr.IInstance = (function() {
	IInstance.prototype = new cr.ModelObject();
	IInstance.prototype._id = null;
	IInstance.prototype._description = "None";
	IInstance.prototype._privilege = null;
	IInstance.prototype._parentID = null;
	IInstance.prototype._dataLoaded = false;
	
	IInstance.prototype.id = function(newID)
	{
		if (newID === undefined)
			return this._id;
		else
		{
			this._id = newID;
			return this;
		}
	}
	
	IInstance.prototype.description = function(newDescription)
	{
		if (newDescription === undefined)
			return this._description;
		else
		{
			this._description = newDescription || "None";
			return this;
		}
	}
	
	IInstance.prototype.privilege = function(newPrivilege)
	{
		if (newPrivilege === undefined)
			return this._privilege;
		else
		{
			this._privilege = newPrivilege;
			return this;
		}
	}
	
	/** if parentID is undefined, returns the parent of this instance. The parent off
	 * an instance is the instance that, when deleted, will automatically delete this instance.
	 *
	 * If parentID is defined, then set the parentID of this instance and return this so that
	 * subsequent operations can be chained.
	 */
	IInstance.prototype.parentID = function(newParentID)
	{
		if (newParentID === undefined)
			return this._parentID && crp.getInstance(this._parentID);
		else
		{
			this._parentID = newParentID;
			return this;
		}
	}
	
	IInstance.prototype.setData = function(d)
	{
		if ('id' in d)
			this.id(d['id'])
		if ('description' in d)
			this.description(d['description'])
		if ('privilege' in d)
			this.privilege(d['privilege']);
		if ('parentID' in d)
		    this.parentID(d['parentID'])
	}
	
	IInstance.prototype.mergeData = function(source)
	{
		// Do nothing.
		if (!this._id) this._id = source._id;
		if (!this._description) this._description = source._description;
		if (!this._privilege) this._privilege = source._privilege;
		if (!this.parentID) this._parentID = source._parentID;
		return this;
	}
	
	/** Returns whether or not this object can be stored in the global
		instance cache.
	 */
	IInstance.prototype.canCache = function()
	{
		return true;
	}
	
	IInstance.prototype.readCheckPromise = function()
	{
		if (this.privilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.description()));
			return result.promise();
		}
		else
		    return undefined;
	}
	
	IInstance.prototype.administerCheckPromise = function()
	{
		if (this.privilege() != cr.privileges.administer)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to administer {0}".format(this.description()));
			return result.promise();
		}
		else
		    return undefined;
	}
	
	IInstance.prototype.canWrite = function()
	{
		if (this.id() === null)
			throw(this.description() + " has not been saved");
			
		return [cr.privileges.write, cr.privileges.administer].indexOf(this.privilege()) >= 0;
	}
	
	/* isEmpty is used to identify temporary instances that are created to fill
		the UI but don't yet have any data. This need may be obsolete.
	 */
	IInstance.prototype.isEmpty = function()
	{
		if (this.id())
		    return false;
		
		return false;
	}
	
	IInstance.prototype.appendUpdateReferenceCommand = function(newValue, f, key, initialData, sourceObjects)
	{
		var onChange = {target: this, update: function() { f(newValue); }};
		if (!newValue)
		{
			if (f())
			{
				initialData[key] = null;
				sourceObjects.push(onChange);
			}
		}
		else if (!f() || f().id() != newValue.id())
		{
			initialData[key] = newValue.id();
			sourceObjects.push(onChange);
		}
	}
	
	IInstance.prototype.appendUpdateValueCommand = function(newValue, f, key, initialData, sourceObjects)
	{
		var onChange = {target: this, update: function() { f(newValue); }};
		if (!newValue)
		{
			if (f())
			{
				initialData[key] = null;
				sourceObjects.push(onChange);
			}
		}
		else if (f() != newValue)
		{
			initialData[key] = newValue;
			sourceObjects.push(onChange);
		}
	}
	
	IInstance.prototype.updateFromChangeData = function(d)
	{
		if ('id' in d)
			this._id = d['id'];
		if ('description' in d)
			this._description = d['description'];
	}

	function IInstance() {
	};
	
	return IInstance;

})();

cr.TranslationInstance = (function() {
	TranslationInstance.prototype = new cr.IInstance();
	
	TranslationInstance.prototype._text = null;
	TranslationInstance.prototype._language = null;
	
	TranslationInstance.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue != this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	TranslationInstance.prototype.language = function(newValue)
	{
		if (newValue === undefined)
			return this._language;
		else
		{
		    if (newValue != this._language)
		    {
				this._language = newValue;
			}
			return this;
		}
	}
	
	TranslationInstance.prototype.setDefaultValues = function()
	{
		this._text = "";
		this._language = null;
	}
	
	TranslationInstance.prototype.setData = function(d)
	{
		this._text = 'text' in d ? d['text'] : "";
		this._position = 'languageCode' in d ? d['languageCode'] : "";
	}
	
	TranslationInstance.prototype.mergeData = function(d)
	{
		cr.IInstance.mergeData.call(this, d);
		if (!this._text) this._text = d._text;
		if (!this._language) this._language = d._language;
	}
	
	function TranslationInstance() {
	    cr.IInstance.call(this);
	};
	
	return TranslationInstance;

})();

cr.ServiceLinkInstance = (function() {
	ServiceLinkInstance.prototype = new cr.IInstance();
	ServiceLinkInstance.prototype._serviceID = null;
	
	ServiceLinkInstance.prototype.setDefaultValues = function()
	{
		this._serviceID = null;
	}
	
	ServiceLinkInstance.prototype.service = function(newValue)
	{
		if (newValue === undefined)
			return crp.getInstance(this._serviceID);
		else
		{
		    if (newValue.id() != this._serviceID)
		    {
				this._serviceID = newValue.id();
			}
			return this;
		}
	}
	
	ServiceLinkInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._serviceID = ('service' in d) ? d['service']['id'] : null;
	}
	
	ServiceLinkInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._serviceID) this._serviceID = source._serviceID;
	}
	
	function ServiceLinkInstance() {
	    cr.IInstance.call(this);
	};
	
	return ServiceLinkInstance;
})();
	
cr.OrderedServiceLinkInstance = (function() {
	OrderedServiceLinkInstance.prototype = new cr.ServiceLinkInstance();
	OrderedServiceLinkInstance.prototype._position = null;
	
	OrderedServiceLinkInstance.prototype.setDefaultValues = function()
	{
		ServiceLinkInstance.prototype.setDefaultValues.call(this);
		this._position = null;
	}
	
	OrderedServiceLinkInstance.prototype.position = function(newValue)
	{
		if (newValue === undefined)
			return this._position;
		else
		{
		    if (newValue != this._position)
		    {
				this._position = newValue.id();
			}
			return this;
		}
	}
	
	OrderedServiceLinkInstance.prototype.setData = function(d)
	{
		cr.ServiceLinkInstance.prototype.setData.call(this, d);
		this._position = d['position'];
	}
	
	OrderedServiceLinkInstance.prototype.mergeData = function(source)
	{
		cr.ServiceLinkInstance.prototype.mergeData.call(this, source);
		if (!this._position) this._position = source._position;
	}
	
	function OrderedServiceLinkInstance() {
	    cr.ServiceLinkInstance.call(this);
	};
	
	return OrderedServiceLinkInstance;
})();
	
cr.UserLinkInstance = (function() {
	UserLinkInstance.prototype = new cr.IInstance();
	UserLinkInstance.prototype._user = null;
	
	UserLinkInstance.prototype.setDefaultValues = function()
	{
		this._user = null;
	}
	
	UserLinkInstance.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
		    if (newValue != this._user)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
	UserLinkInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('user' in d)
		{
			this._user = new cr.User();
			this._user.setData(d['user']);
			this._user = crp.pushInstance(this._user);
		}
    }
    
	UserLinkInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._user) this._user = source._user;
	}
	
	function UserLinkInstance() {
	    cr.IInstance.call(this);
	};
	
	return UserLinkInstance;
})();
	
cr.Grantable = (function() {
	Grantable.prototype = new cr.IInstance();
	Grantable.prototype._grantTarget = null;
	Grantable.prototype._grantTargetPromise = null;

	Grantable.prototype.grantTarget = function()
	{
		return this._grantTarget;
	}
	
	Grantable.prototype.publicAccess = function(newValue)
	{
		return this._grantTarget.publicAccess(newValue);
	}
	
	Grantable.prototype.primaryAdministrator = function(newValue)
	{
		return this._grantTarget.primaryAdministrator(newValue);
	}
	
    Grantable.prototype.promiseGrantTarget = function()
    {
    	p = this.administerCheckPromise();
    	if (p) return p;

        if (this._grantTargetPromise)
        	return this._grantTargetPromise;
        else if (this._grantTarget)
        {
        	result = $.Deferred();
        	result.resolve(this._grantTarget);
        	return result;
        }
        
        var _this = this;	
        this._grantTargetPromise = cr.getData(
        	{
        		path: 'grant target/{0}'.format(this.id()),
        		fields: [],
        		resultType: cr.GrantTarget
        	})
        	.done(function(grantTargets)
        		{
        			_this._grantTarget = grantTargets[0];
        			result = $.Deferred();
        			result.resolve(_this._grantTarget);
        			return result;
        		});
        return this._grantTargetPromise;
    }
    
    function Grantable() {
    	cr.IInstance.call(this);
    }
    
    return Grantable;
    
})();

cr.Grant = (function() {
	Grant.prototype = new cr.IInstance();
	Grant.prototype._grantee = null;
	Grant.prototype._privilege = null;
	
	Grant.prototype.grantee = function(newValue)
	{
		if (newValue === undefined)
			return this._grantee;
		else
		{
		    if (newValue.id() != this._grantee.id())
		    {
				this._grantee = newValue;
			}
			return this;
		}
	}
	
	Grant.prototype.privilege = function(newValue)
	{
		if (newValue === undefined)
			return this._privilege;
		else
		{
		    if (newValue != this._privilege)
		    {
				this._privilege = newValue;
			}
			return this;
		}
	}
	
	Grant.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('grantee' in d)
		{
			this._grantee = new (this.granteeType())();
			this._grantee.setData(d['grantee']);
			this._grantee = crp.pushInstance(this._grantee);
		}
		this._privilege = 'privilege' in d ? d['privilege'] : "";
	}
	
	Grant.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._grantee && source.grantee())
			this._grantee = source.grantee();
		if (!this._privilege)
			this._privilege = source.privilege();	
	}
	
	/** Returns whether or not this object can be stored in the global
		instance cache.
	 */
	Grant.prototype.canCache = function()
	{
		/* Don't cache these, because they have the same IDs as their grantables. */
		return false;
	}
	
	function Grant() {
	    cr.IInstance.call(this);
	};
	
	return Grant;

})();
	
cr.AccessInstance = (function() {
	AccessInstance.prototype = new cr.IInstance();
	AccessInstance.prototype._grantee = null;
	
	AccessInstance.prototype.setDefaultValues = function()
	{
		this._grantee = null;
	}
	
	AccessInstance.prototype.grantee = function(newValue)
	{
		if (newValue === undefined)
			return this._grantee;
		else
		{
		    if (newValue.id() != this._grantee.id())
		    {
				this._grantee = newValue;
			}
			return this;
		}
	}
	
	AccessInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._grantee = new cr.User();
		this._grantee.setData(d['grantee']);
	}
	
	function AccessInstance() {
	    cr.IInstance.call(this);
	};
	
	return AccessInstance;
})();
	
cr.Address = (function() {
	Address.prototype = new cr.IInstance();
	
	function Address() {
	    cr.IInstance.call(this);
	};
	
	return Address;

})();
	
cr.Comment = (function() {
	Comment.prototype = new cr.IInstance();
	Comment.prototype._text = null;
	Comment.prototype._question = null;
	Comment.prototype._asker = null;
	
	Comment.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue != this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.appendUpdateTextCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.text, 'text', initialData, sourceObjects);
	}

	Comment.prototype.question = function(newValue)
	{
		if (newValue === undefined)
			return this._question;
		else
		{
		    if (newValue != this._question)
		    {
				this._question = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.appendUpdateQuestionCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.question, 'question', initialData, sourceObjects);
	}

	Comment.prototype.asker = function(newValue)
	{
		if (newValue === undefined)
			return this._asker;
		else
		{
		    if (newValue != this._asker)
		    {
				this._asker = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('asker' in d)
		{
			this._asker = new cr.Path();
			this._asker.setData(d['asker']);
			this._asker = crp.pushInstance(d['asker']);
		}
		this._text = 'text' in d ? d['text'] : "";
		this._question = 'question' in d ? d['question'] : "";
    }
    
    Comment.prototype.mergeData = function(source)
    {
    	cr.IInstance.prototype.mergeData.call(this, source);
    	if (!this._user) this._user = source._user;
    	if (!this._text) this._text = source._text;
    	if (!this._question) this._question = source._question;
    }
    
	function Comment() {
	    cr.IInstance.call(this);
	};
	
	return Comment;

})();
	
cr.CommentPrompt = (function() {
	CommentPrompt.prototype = new cr.IInstance();
	CommentPrompt.prototype._translations = null;
	
	CommentPrompt.prototype.translations = function(newValue)
	{
		if (newValue === undefined)
			return this._translations;
		else
		{
		    if (newValue != this._translations)
		    {
				this._translations = newValue;
			}
			return this;
		}
	}
	
	CommentPrompt.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('translations' in d)
			this._translations = d['translations'].map(function(d) {
								var i = new cr.CommentPromptText();
								i.setData(d);
								return i;
							});
    }
    
	function CommentPrompt() {
	    cr.IInstance.call(this);
	};
	
	return CommentPrompt;

})();
	
cr.CommentPromptText = (function() {
	CommentPromptText.prototype = new cr.TranslationInstance();
	
	function CommentPromptText() {
	    cr.TranslationInstance.call(this);
	};
	
	return CommentPromptText;

})();
	
cr.DisqualifyingTag = (function() {
	DisqualifyingTag.prototype = new cr.IInstance();
	
	function DisqualifyingTag() {
	    cr.IInstance.call(this);
	};
	
	return DisqualifyingTag;

})();
	
cr.Engagement = (function() {
	Engagement.prototype = new cr.UserLinkInstance();
	Engagement.prototype._user = null;
	Engagement.prototype._start = null;
	Engagement.prototype._end = null;
	Engagement.prototype._organization = null;
	Engagement.prototype._site = null;
	Engagement.prototype._offering = null;
	
	Engagement.prototype.start = function(newValue)
	{
		if (newValue === undefined)
			return this._start;
		else
		{
		    if (newValue != this._start)
		    {
				this._start = newValue;
			}
			return this;
		}
	}

	Engagement.prototype.end = function(newValue)
	{
		if (newValue === undefined)
			return this._end;
		else
		{
		    if (newValue != this._end)
		    {
				this._end = newValue;
			}
			return this;
		}
	}
	
	Engagement.prototype.organization = function(newValue)
	{
		if (newValue === undefined)
			return this._organization;
		else
		{
			if (!this._organization ||
			    newValue.id != this._organization.id())
			{
				this._organization = new cr.Organization();
				this._organization.setData(newValue);
			}
		}
	}

	Engagement.prototype.site = function(newValue)
	{
		if (newValue === undefined)
			return this._site;
		else
		{
			if (!this._site ||
			    newValue.id != this._site.id())
			{
				this._site = new cr.Site();
				this._site.setData(newValue);
			}
		}
	}

	Engagement.prototype.offering = function(newValue)
	{
		if (newValue === undefined)
			return this._offering;
		else
		{
			if (!this._offering ||
			    newValue.id != this._offering.id())
			{
				this._offering = new cr.Offering();
				this._offering.setData(newValue);
				this._offering = crp.getInstance(this._offering.id());
			}
		}
	}

	Engagement.prototype.setData = function(d)
	{
		cr.UserLinkInstance.prototype.setData.call(this, d);
		this._start = 'start' in d ? d['start'] : "";
		this._end = 'end' in d ? d['end'] : "";
		if ('organization' in d)
		{
			this._organization = new cr.Organization();
			this._organization.setData(d['organization']);
			this._organization = crp.pushInstance(this._organization);
		}
		if ('site' in d)
		{
			this._site = new cr.Organization();
			this._site.setData(d['site']);
			this._site = crp.pushInstance(this._site);
		}
		if ('offering' in d)
		{
			this._offering = new cr.Offering();
			this._offering.setData(d['offering']);
			this._offering = crp.pushInstance(this._offering);
		}
    }
    
    Engagement.prototype.mergeData = function(source)
    {
		cr.UserLinkInstance.prototype.setData.call(this, d);
		if (!this._start) this._start = source._start;
		if (!this._end) this._end = source._end;
		if (!this._organization) this._organization = source._organization;
		if (!this._site) this._site = source._site;
		if (!this._offering) this._offering = source._offering;
    }
    
	function Engagement() {
	    cr.UserLinkInstance.call(this);
	};
	
	return Engagement;

})();
	
cr.Enrollment = (function() {
	Enrollment.prototype = new cr.IInstance();
	
	function Enrollment() {
	    cr.IInstance.call(this);
	};
	
	return Enrollment;

})();
	
cr.Experience = (function() {
	Experience.prototype = new cr.IInstance();
	Experience.prototype._path = null;
	Experience.prototype._organization = null;
	Experience.prototype._customOrganization = null;
	Experience.prototype._site = null;
	Experience.prototype._customSite = null;
	Experience.prototype._offering = null;
	Experience.prototype._customOffering = null;
	Experience.prototype._start = null;
	Experience.prototype._end = null;
	Experience.prototype._timeframe = null;
	Experience.prototype._services = null;
	Experience.prototype._customServices = null;
	Experience.prototype._comments = null;
	Experience.prototype._commentsPromise = null;
	
	Experience.prototype.path = function(newValue)
	{
		if (newValue === undefined)
			return this._path;
		else
		{
		    if (newValue != this._path)
		    {
				this._path = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.organization = function(newValue)
	{
		if (newValue === undefined)
			return this._organization;
		else
		{
		    if (newValue != this._organization)
		    {
				this._organization = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateOrganizationCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateReferenceCommand(newValue, 
			this.organization, 'organization', initialData, sourceObjects);
	}

	Experience.prototype.customOrganization = function(newValue)
	{
		if (newValue === undefined)
			return this._customOrganization;
		else
		{
		    if (newValue != this._customOrganization)
		    {
				this._customOrganization = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateCustomOrganizationCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.customOrganization, 'custom organization', initialData, sourceObjects);
	}

	Experience.prototype.site = function(newValue)
	{
		if (newValue === undefined)
			return this._site;
		else
		{
		    if (newValue != this._site)
		    {
				this._site = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateSiteCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateReferenceCommand(newValue, 
			this.site, 'site', initialData, sourceObjects);
	}

	Experience.prototype.customSite = function(newValue)
	{
		if (newValue === undefined)
			return this._customSite;
		else
		{
		    if (newValue != this._customSite)
		    {
				this._customSite = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateCustomSiteCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.customSite, 'custom site', initialData, sourceObjects);
	}

	Experience.prototype.offering = function(newValue)
	{
		if (newValue === undefined)
			return this._offering;
		else
		{
		    if (newValue != this._offering)
		    {
				this._offering = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateOfferingCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateReferenceCommand(newValue, 
			this.offering, 'offering', initialData, sourceObjects);
	}

	Experience.prototype.customOffering = function(newValue)
	{
		if (newValue === undefined)
			return this._customOffering;
		else
		{
		    if (newValue != this._customOffering)
		    {
				this._customOffering = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateCustomOfferingCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.customOffering, 'custom offering', initialData, sourceObjects);
	}

	Experience.prototype.start = function(newValue)
	{
		if (newValue === undefined)
			return this._start;
		else
		{
		    if (newValue != this._start)
		    {
				this._start = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateStartCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.start, 'start', initialData, sourceObjects);
	}

	Experience.prototype.end = function(newValue)
	{
		if (newValue === undefined)
			return this._end;
		else
		{
		    if (newValue != this._end)
		    {
				this._end = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateEndCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.end, 'end', initialData, sourceObjects);
	}

	Experience.prototype.timeframe = function(newValue)
	{
		if (newValue === undefined)
			return this._timeframe;
		else
		{
		    if (newValue != this._timeframe)
		    {
				this._timeframe = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.appendUpdateTimeframeCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.timeframe, 'timeframe', initialData, sourceObjects);
	}

	Experience.prototype.services = function(newValue)
	{
		if (newValue === undefined)
			return this._services;
		else
		{
		    if (newValue != this._services)
		    {
				this._services = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.customServices = function(newValue)
	{
		if (newValue === undefined)
			return this._customServices;
		else
		{
		    if (newValue != this._customServices)
		    {
				this._customServices = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.comments = function(newValue)
	{
		if (newValue === undefined)
			return this._comments;
		else
		{
		    if (newValue != this._comments)
		    {
				this._comments = newValue;
			}
			return this;
		}
	}
	
	/* Copies all of the data associated with this experience except the comments.
	 */
	Experience.prototype.duplicateData = function(newExperience)
	{
		newExperience._path = this._path;
		newExperience._organization = this._organization;
		newExperience._customOrganization = this._customOrganization
		newExperience._site = this._site;
		newExperience._customSite = this._customSite;
		newExperience._offering = this._offering;
		newExperience._customOffering = this._customOffering;
		newExperience._start = this._start;
		newExperience._end = this._end;
		newExperience._timeframe = this._timeframe;
		newExperience._services = this._services.map(function(i)
			{
				target = new cr.ExperienceService();
				i.copyData(target);
				return target;
			});
		newExperience._customServices = this._customServices.map(function(i)
			{
				target = new cr.ExperienceCustomService();
				i.copyData(target);
				return target;
			});
	}
	
	Experience.prototype.promiseCopy = function(newExperience)
	{
		var _this = this;
		return this.promiseComments()
			.then(function()
				{
					_this.duplicateData(newExperience);
					newExperience._comments = this._comments.map(function(i)
						{
							target = new cr.Comment();
							target.mergeData(i);
							return target;
						});
						
					r = $.Deferred();
					r.resolve(newExperience);
					return r;
				});
	}
	
	Experience.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('organization' in d) {
			this._organization = new cr.Organization();
			this._organization.setData(d['organization']);
		}
		else
			this._organization = null;
		this._customOrganization = 'custom organization' in d ? d['custom organization'] : "";
		if ('site' in d) {
			this._site = new cr.Site();
			this._site.setData(d['site']);
		}
		else
			this._site = null;
		this._customSite = 'custom site' in d ? d['custom site'] : "";
		if ('offering' in d) {
			this._offering = new cr.Offering();
			this._offering.setData(d['offering']);
			this._offering = crp.pushInstance(this._offering);
		}
		else
			this._offering = null;
		this._customOffering = 'custom offering' in d ? d['custom offering'] : "";
		this._start = 'start' in d ? d['start'] : "";
		this._end = 'end' in d ? d['end'] : "";
		this._timeframe = 'timeframe' in d ? d['timeframe'] : "";
		if ('services' in d)
			this._services = d['services'].map(function(d) {
								var i = new cr.ExperienceService();
								i.setData(d);
								return i;
							});
		if ('custom services' in d)
			this._customServices = d['custom services'].map(function(d) {
								var i = new cr.ExperienceCustomService();
								i.setData(d);
								return i;
							});
		if ('comments' in d)
			this._comments = d['comments'].map(function(d) {
								var i = new cr.Comment();
								i.setData(d);
								return i;
							});
    }
    
	Experience.prototype.calculateDescription = function(languageCode)
	{
// 		if (!this.getCells())
// 		{
// 			if (!this.description())
// 				this.description("None");
// 		}
// 		else
		{
			if (this._offering)
				this.description(this._offering.description());
			else if (this._customOffering)
			    this.description(this._customOffering);
			else
			    this.description('Unnamed Offering');
		}
	}
	
	Experience.prototype.promiseOffering = function()
	{
		// No longer needed?
		offering = experience._offering;
		if (offering && offering.id() && !offering.names)
		{
			var storedI = crp.getInstance(offering.id());
			if (storedI && storedI.getCells())
			{
				offering.importCells(storedI.getCells());
				r = $.Deferred();
				r.resolve();
				return r;
			}
			else
			{
				return offering.promiseCells();
			}
		}
		else
		{
			r = $.Deferred();
			r.resolve();
			return r;
		}
	}
	
    Experience.prototype.promiseComments = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._commentsPromise)
        	return this._commentsPromise;
        else if (this._comments)
        {
        	result = $.Deferred();
        	result.resolve(this._comments);
        	return result;
        }
        
        var _this = this;	
        this._commentsPromise = cr.getData(
        	{
        		path: 'experience/{0}/comment'.format(this.id()),
        		fields: [],
        		resultType: cr.Comment
        	})
        	.done(function(comments)
        		{
        			_this._comments = comments;
        			result = $.Deferred();
        			result.resolve(comments);
        			return result;
        		});
        return this._commentsPromise;
    }
    
	Experience.prototype.pickedOrCreatedText = function(picked, created)
	{
		if (picked && picked.id())
			return picked.description();
		else
			return created;
	}

	Experience.prototype.dateRange = function()
	{
		var startDate = this.start();
		startDate = startDate ? getLocaleDateString(startDate) : "";
		
		var endDate = this.end();
		endDate = endDate ? getLocaleDateString(endDate) : "";
		
		if (startDate || endDate)
			return "{0} - {1}".format(startDate, endDate);
		else
			return "";
	}

	Experience.prototype.getTagList = function()
	{
		var names = [];
	
		var offering = this.offering();
		if (offering && offering.id())
		{
			if (!offering.services())
				throw new Error("Runtime error: offering services are not loaded");
			
			names = offering.services()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); });
		}
	
		var services = this.services();
		var customServices = this.customServices();

		if (services)
			names = names.concat(services
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); }));
	
		if (customServices)
			names = names.concat(customServices
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); }));
	
		return names.join(", ");
	}

	Experience.prototype.getPhase = function()
	{
		var t = this.timeframe();
		if (t)
			return t;
			
		var todayDate = getUTCTodayDate().toISOString().substr(0, 10);
		if (!this.start() || this.start() > todayDate)
			return 'Goal';
		else if (!this.end() || this.end() > todayDate)
			return 'Current';
		else
			return 'Previous';
	}
	
	Experience.prototype.organizationName = function()
	{
		if (this.organization())
		    return this.organization().description();
		else
		    return this.customOrganization();
	}
	
	Experience.prototype.siteName = function()
	{
		if (this.site())
		    return this.site().description();
		else
		    return this.customSite();
	}
	
	Experience.prototype.offeringName = function()
	{
		if (this.offering())
		    return this.offering().description();
		else
		    return this.customOffering();
	}
	
	function Experience() {
	    cr.IInstance.call(this);
	};
	
	return Experience;

})();
	
cr.ExperienceCustomService = (function() {
	ExperienceCustomService.prototype = new cr.IInstance();
	ExperienceCustomService.prototype._name = null;
	ExperienceCustomService.prototype._position = null;
	
	ExperienceCustomService.prototype.position = function(newValue)
	{
		if (newValue === undefined)
			return this._position;
		else
		{
		    if (newValue != this._position)
		    {
				this._position = newValue.id();
			}
			return this;
		}
	}
	
	ExperienceCustomService.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue.id();
			}
			return this;
		}
	}
	
	ExperienceCustomService.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._name = 'name' in d ? d['name'] : "";
		this._position = 'position' in d ? d['position'] : 0;
    }
    
    ExperienceCustomService.prototype.mergeData = function(source)
    {
    	cr.IInstance.prototype.mergeData.call(this, source);
    	if (!this._name) this._name = source._name;
    	if (this._position === null) this._position = source._position;
    }
    
    ExperienceCustomService.prototype.copyData = function(target)
    {
    	cr.IInstance.prototype.copyData.call(this, target);
    	target._name = this._name;
    	target._position = this._position;
    }
    
	function ExperienceCustomService() {
	    cr.IInstance.call(this);
	};
	
	return ExperienceCustomService;

})();
	
cr.ExperienceService = (function() {
	ExperienceService.prototype = new cr.OrderedServiceLinkInstance();
	
	function ExperienceService() {
	    cr.OrderedServiceLinkInstance.call(this);
	};
	
	return ExperienceService;

})();
	
cr.ExperiencePrompt = (function() {
	ExperiencePrompt.prototype = new cr.IInstance();
	
	function ExperiencePrompt() {
	    cr.IInstance.call(this);
	};
	
	return ExperiencePrompt;

})();
	
cr.ExperiencePromptService = (function() {
	ExperiencePromptService.prototype = new cr.IInstance();
	
	function ExperiencePromptService() {
	    cr.IInstance.call(this);
	};
	
	return ExperiencePromptService;

})();
	
cr.ExperiencePromptText = (function() {
	ExperiencePromptText.prototype = new cr.IInstance();
	
	function ExperiencePromptText() {
	    cr.IInstance.call(this);
	};
	
	return ExperiencePromptText;

})();
	
cr.GrantTarget = (function() {
	GrantTarget.prototype = new cr.IInstance();
	GrantTarget.prototype._publicAccess = null;
	GrantTarget.prototype._primaryAdministrator = null;
	GrantTarget.prototype._userGrants = null;
	GrantTarget.prototype._groupGrants = null;
	
	GrantTarget.prototype.publicAccess = function(newValue)
	{
		if (newValue === undefined)
			return this._publicAccess;
		else
		{
			if (this._publicAccess != newValue)
			{
				this._publicAccess = newValue;
			}
			return this;
		}
	}
	
	GrantTarget.prototype.primaryAdministrator = function(newValue)
	{
		if (newValue === undefined)
			return this._primaryAdministrator;
		else
		{
			if (this._primaryAdministrator != newValue)
			{
				this._primaryAdministrator = newValue;
			}
			return this;
		}
	}
	
	GrantTarget.prototype.userGrants = function(newValue)
	{
		if (newValue === undefined)
			return this._userGrants;
		else
		{
			this._userGrants = newValue;
			return this;
		}
	}
	
	GrantTarget.prototype.groupGrants = function(newValue)
	{
		if (newValue === undefined)
			return this._groupGrants;
		else
		{
			this._groupGrants = newValue;
			return this;
		}
	}
	
	GrantTarget.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._publicAccess = 'public access' in d ? d['public access'] : "";
		if ('primary administrator' in d)
		{
		    this._primaryAdministrator = new cr.User();
		    this._primaryAdministrator.setData(d['primary administrator']);
		    this._primaryAdministrator = crp.getInstance(this._primaryAdministrator);
		}
		if ('user grants' in d)
			this._userGrants = d['user grants'].map(function(d) {
								var i = new cr.UserGrant();
								i.setData(d);
								return i;
							});
		if ('group grants' in d)
			this._groupGrants = d['group grants'].map(function(d) {
								var i = new cr.GroupGrant();
								i.setData(d);
								return i;
							});
    }
    
	/** Returns whether or not this object can be stored in the global
		instance cache.
	 */
	GrantTarget.prototype.canCache = function()
	{
		/* Don't cache these, because they have the same IDs as their grantables. */
		return false;
	}
	

	function GrantTarget() {
	    cr.IInstance.call(this);
	};
	
	return GrantTarget;

})();
	
cr.Group = (function() {
	Group.prototype = new cr.IInstance();
	
	function Group() {
	    cr.IInstance.call(this);
	};
	
	return Group;

})();
	
cr.GroupGrant = (function() {
	GroupGrant.prototype = new cr.Grant();
	
	GroupGrant.prototype.granteeType = function()
	{
		return cr.Group;
	}
	
	function GroupGrant() {
	    cr.Grant.call(this);
	};
	
	return GroupGrant;

})();
	
cr.GroupName = (function() {
	GroupName.prototype = new cr.TranslationInstance();
	
	function GroupName() {
	    cr.TranslationInstance.call(this);
	};
	
	return GroupName;

})();
	
cr.GroupMember = (function() {
	GroupMember.prototype = new cr.IInstance();
	
	function GroupMember() {
	    cr.IInstance.call(this);
	};
	
	return GroupMember;

})();
	
cr.Inquiry = (function() {
	Inquiry.prototype = new cr.IInstance();
	
	function Inquiry() {
	    cr.IInstance.call(this);
	};
	
	return Inquiry;

})();
	
cr.Notification = (function() {
	Notification.prototype = new cr.IInstance();
	Notification.prototype._name = null;
	Notification.prototype._isFresh = null;
	Notification.prototype._arguments = null;
	
	Notification.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.isFresh = function(newValue)
	{
		if (newValue === undefined)
			return this._isFresh;
		else
		{
		    if (newValue != this._isFresh)
		    {
				this._isFresh = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.appendUpdateIsFreshCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.isFresh, 'is fresh', initialData, sourceObjects);
	}

	/* Use the abbreviation args instead of arguments because "arguments" is 
	   a reserved word in Javascript.
	 */
	Notification.prototype.args = function(newValue)
	{
		if (newValue === undefined)
			return this._arguments;
		else
		{
		    if (newValue != this._arguments)
		    {
				this._arguments = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._name = 'name' in d ? d['name'] : "";
		this._isFresh = 'is fresh' in d ? d['is fresh'] : "";
		var f = this.controller();
		this._arguments = f.parseArguments(d['arguments']);
    }
    
    Notification.prototype.controller = function()
    {
    	return crn[this._name.split(".")[1]];
    }
    
	function Notification() {
	    cr.IInstance.call(this);
	};
	
	return Notification;

})();
	
cr.NotificationArgument = (function() {
	NotificationArgument.prototype = new cr.IInstance();
	
	function NotificationArgument() {
	    cr.IInstance.call(this);
	};
	
	return NotificationArgument;

})();
	
cr.Offering = (function() {
	Offering.prototype = new cr.IInstance();
	Offering.prototype._names = null;
    Offering.prototype._webSite = null;
    Offering.prototype._minimumAge = null;
    Offering.prototype._maximumAge = null;
    Offering.prototype._minimumGrade = null;
    Offering.prototype._maximumGrade = null;
    Offering.prototype._services = null;
    Offering.prototype._sessions = null;
    Offering.prototype._organization = null;
    Offering.prototype._site = null;
	
	Offering.prototype.names = function(newData)
	{
		if (newData === undefined)
			return this._names;
		else
		{
			this._names = newData.map(function(d)
				{
					var i = new cr.OfferingName();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Offering.prototype.webSite = function(newValue)
	{
		if (newValue === undefined)
			return this._webSite;
		else
		{
		    if (newValue != this._webSite)
		    {
				this._webSite = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.minimumAge = function(newValue)
	{
		if (newValue === undefined)
			return this._minimumAge;
		else
		{
		    if (newValue != this._minimumAge)
		    {
				this._minimumAge = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.maximumAge = function(newValue)
	{
		if (newValue === undefined)
			return this._maximumAge;
		else
		{
		    if (newValue != this._maximumAge)
		    {
				this._maximumAge = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.minimumGrade = function(newValue)
	{
		if (newValue === undefined)
			return this._minimumGrade;
		else
		{
		    if (newValue != this._minimumGrade)
		    {
				this._minimumGrade = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.maximumGrade = function(newValue)
	{
		if (newValue === undefined)
			return this._maximumGrade;
		else
		{
		    if (newValue != this._maximumGrade)
		    {
				this._maximumGrade = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.services = function(newValue)
	{
		if (newValue === undefined)
			return this._services;
		else
		{
		    if (newValue != this._services)
		    {
				this._services = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.sessions = function(newValue)
	{
		if (newValue === undefined)
			return this._sessions;
		else
		{
		    if (newValue != this._sessions)
		    {
				this._sessions = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('name' in d)
			this.names(d['name']);
		this._webSite = 'web site' in d ? d['web site'] : "";
		this._minimumAge = 'minimum age' in d ? d['minimum age'] : "";
		this._maximumAge = 'maximum age' in d ? d['maximum age'] : "";
		this._minimumGrade = 'minimum grade' in d ? d['minimum grade'] : "";
		this._maximumGrade = 'maximum grade' in d ? d['maximum grade'] : "";
		if ('services' in d)
			this._services = d['services'].map(function(d) {
								var i = new cr.OfferingService();
								i.setData(d);
								return i;
							});
		if ('sessions' in d)
			this._sessions = d['sessions'].map(function(d) {
								var i = new cr.Session();
								i.setData(d);
								return i;
							});
		if ('organization' in d)
		{
		    this._organization = new cr.Organization();
		    this._organization.setData(d['organization']);
		    this._organization = crp.pushInstance(this._organization);
		}
		if ('site' in d)
		{
		    this._site = new cr.Site();
		    this._site.setData(d['site']);
		    this._site = crp.pushInstance(this._site);
		}
    }
    
	Offering.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names.map(function(i)
				{
					j = new OfferingName();
					j.mergeData(i);
					return j;
				});
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._minimumAge) this._minimumAge = source._minimumAge;
		if (!this._maximumAge) this._maximumAge = source._maximumAge;
		if (!this._minimumGrade) this._minimumGrade = source._minimumGrade;
		if (!this._maximumGrade) this._maximumGrade = source._maximumGrade;
		if (!this._services && source._services)
			this._services = source._services.map(function(i)
				{
					j = new cr.OfferingService();
					j.mergeData(i);
					return j;
				});
		if (!this._sessions && source._sessions)
			this._sessions = source._sessions.map(function(i)
				{
					j = new cr.Session();
					j.mergeData(i);
					return j;
				});
		if (!this._organization) this._organization = source._organization;
		if (!this._site) this._site = source._site;
		return this;
	}
	
    
	Offering.prototype.ageRange = function()
	{
		var min = this.minimumAge();
		var max = this.maximumAge();
		if (min)
		{
			if (max)
			{
				if (min == max)
					return min;
				else
					return min + " - " + max;
			}
			else
				return min + " or older";
		}
		else if (max)
		{
			return "up to " + max;
		}
		else
			return "";
	}

	Offering.prototype.gradeRange = function()
	{
		var min = this.minimumGrade();
		var max = this.maximumGrade();
		if (min)
		{
			if (max)
			{
				if (min == max)
					return min;
				else
					return min + " - " + max;
			}
			else
				return min + " or beyond";
		}
		else if (max)
		{
			return "up to " + max;
		}
		else
			return "";
	}

	function Offering() {
	    cr.IInstance.call(this);
	};
	
	return Offering;

})();
	
cr.OfferingName = (function() {
	OfferingName.prototype = new cr.TranslationInstance();
	
	function OfferingName() {
	    cr.TranslationInstance.call(this);
	};
	
	return OfferingName;

})();
	
cr.OfferingService = (function() {
	OfferingService.prototype = new cr.OrderedServiceLinkInstance();
	
	function OfferingService() {
	    cr.OrderedServiceLinkInstance.call(this);
	};
	
	return OfferingService;

})();
	
cr.Organization = (function() {
	Organization.prototype = new cr.Grantable();
	
	function Organization() {
	    cr.Grantable.call(this);
	};
	
	return Organization;

})();
	
cr.OrganizationName = (function() {
	OrganizationName.prototype = new cr.IInstance();
	
	function OrganizationName() {
	    cr.IInstance.call(this);
	};
	
	return OrganizationName;

})();
	
cr.Path = (function() {
	Path.prototype = new cr.Grantable();
	Path.prototype._birthday = null;
	Path.prototype._name = null;
	Path.prototype._specialAccess = null;
	Path.prototype._canAnswerExperience = null;
	Path.prototype._experiences = null;
	Path.prototype._experiencesPromise = null;
	Path.prototype._user = null;
	Path.prototype._userPromise = null;
	
	Path.prototype.birthday = function(newValue)
	{
		if (newValue === undefined)
			return this._birthday;
		else
		{
		    if (newValue != this._birthday)
		    {
				this._birthday = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.specialAccess = function(newValue)
	{
		if (newValue === undefined)
			return this._specialAccess;
		else
		{
		    if (newValue != this._specialAccess)
		    {
				this._specialAccess = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.canAnswerExperience = function(newValue)
	{
		if (newValue === undefined)
			return this._canAnswerExperience;
		else
		{
		    if (newValue != this._canAnswerExperience)
		    {
				this._canAnswerExperience = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
		    if (newValue != this._user)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
    Path.prototype.promiseUser = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._userPromise)
        	return this._userPromise;
        else if (this._user)
        {
        	result = $.Deferred();
        	result.resolve(this._user);
        	return result;
        }
        else if (this._parentID && crp.getInstance(this._parentID))
        {
        	this._user = crp.getInstance(this._parentID);
        	result = $.Deferred();
        	result.resolve(this._user);
        	return result;
		}
		        
        var _this = this;	
        this._userPromise = cr.getData(
        	{
        		path: 'path/{0}/user'.format(this.id()),
        		fields: [],
        		resultType: cr.User
        	})
        	.done(function(users)
        		{
        			var user = users[0];
        			_this._user = user;
        			user.path(_this);
        			result = $.Deferred();
        			result.resolve(user);
        			return result;
        		});
        return this._userPromise;
    }
    
	Path.prototype.setData = function(d)
	{
		cr.Grantable.prototype.setData.call(this, d);
		this._birthday = 'birthday' in d ? d['birthday'] : "";
		this._name = 'name' in d ? d['name'] : "";
		this._specialAccess = 'special access' in d ? d['special access'] : "";
		this._canAnswerExperience = 'can answer experience' in d ? d['can answer experience'] : "";
		if ('experiences' in d)
			this._experiences = d['experiences'].map(function(d) {
								var i = new cr.Experience();
								i.setData(d);
								return i;
							});
		if ('user' in d)
		{
			this._user = new cr.User();
			this._user.setData(d['user']);
		}
    }
    
    Path.prototype.experiences = function(newValue)
    {
    	if (newValue === undefined)
    	{
    		if (this._experiences === null)
    			throw new Error("Runtime Error: experiences of a path have not been set");
    		else
    			return this._experiences;
    	}
    	else
    	{
    		this._experiences = newValue;
    	}
    }
    
    Path.prototype.promiseExperiences = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._experiencesPromise)
        	return this._experiencesPromise;
        else if (this._experiences)
        {
        	result = $.Deferred();
        	result.resolve(this._experiences);
        	return result;
        }
        
        var _this = this;	
        this._experiencesPromise = cr.getData(
        	{
        		path: 'path/{0}/experience'.format(this.id()),
        		fields: ['service', 'custom service'],
        		resultType: cr.Experience
        	})
        	.done(function(experiences)
        		{
        			_this._experiences = experiences;
        			_this._experiences.forEach(function(e)
        				{
        					e.path(_this);
        				});
        			result = $.Deferred();
        			result.resolve(experiences);
        			return result;
        		});
        return this._experiencesPromise;
    }
    
	function Path() {
	    cr.Grantable.call(this);
	};
	
	return Path;

})();
	
cr.Period = (function() {
	Period.prototype = new cr.IInstance();
	
	function Period() {
	    cr.IInstance.call(this);
	};
	
	return Period;

})();
	
cr.Service = (function() {
	Service.prototype = new cr.IInstance();
	Service.prototype._stage = null;
	Service.prototype._names = null;
	Service.prototype._organizationLabels = null;
	Service.prototype._siteLabels = null;
	Service.prototype._offeringLabels = null;
	Service.prototype._services = null;
	
	Service.prototype.stage = function(newValue)
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
	
	Service.prototype.names = function(newData)
	{
		if (newData === undefined)
			return this._names;
		else
		{
			this._names = newData.map(function(d)
				{
					var i = new cr.ServiceName();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.organizationLabels = function(newData)
	{
		if (newData === undefined)
			return this._organizationLabels;
		else
		{
			this._organizationLabels = newData.map(function(d)
				{
					var i = new cr.ServiceOrganizationLabel();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.siteLabels = function(newData)
	{
		if (newData === undefined)
			return this._siteLabels;
		else
		{
			this._siteLabels = newData.map(function(d)
				{
					var i = new cr.ServiceSiteLabel();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.offeringLabels = function(newData)
	{
		if (newData === undefined)
			return this._offeringLabels;
		else
		{
			this._offeringLabels = newData.map(function(d)
				{
					var i = new cr.ServiceOfferingLabel();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.services = function(newData)
	{
		if (newData === undefined)
			return this._services;
		else
		{
			this._services = newData.map(function(d)
				{
					var i = new cr.ServiceImplication();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Service.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._stage = 'stage' in d ? d['stage'] : "";
		if ('names' in d)
			this.names(d['names']);
		if ('organization labels' in d)
			this.organizationLabels(d['organization labels']);
		if ('site labels' in d)
			this.siteLabels(d['site labels']);
		if ('offering labels' in d)
			this.offeringLabels(d['offering labels']);
		if ('services' in d)
			this.services(d['services']);
	}
	
    Service.servicesPromise = function()
    {
        if (cr.Service._servicesPromise)
        	return cr.Service._servicesPromise;
        
        cr.Service._servicesPromise = cr.getData(
        	{
        		path: 'service',
        		fields: ['services'],
        		resultType: cr.Service
        	})
        	.done(function(services)
        		{
        			result = $.Deferred();
        			result.resolve(services);
        			return result;
        		});
        return cr.Service._servicesPromise;
    }
    
	Service.prototype.stageColumns = {
		Housing: 0,
		Studying: 1,
		Certificate: 1,
		Training: 2,
		Whatever: 2,
		Working: 3,
		Teaching: 3,
		Expert: 3,
		Skills: 4,
		Mentoring: 5,
		Tutoring: 5,
		Coaching: 5,
		Volunteering: 5,
		Wellness: 6,
	};
	
	Service.prototype.getStageDescription = function(stage)
	{
		return stage in this.stageColumns && stage;
	}
	
	Service.prototype.getColumn = function()
	{
		var stage = this.stage();
		var stageDescription = this.getStageDescription(stage);
		if (stageDescription)
			return this.stageColumns[stageDescription];
		var _this = this;
			
		if (this.id())
		{
			var services = this.services();
			/* services may be null if the service has been deleted */
			var s = services && services.map(function(s)
				{
					return s.service();
				})
				.find(function(s)
				{
					var stage =  s.stage();
					return s.getStageDescription(stage);
				});
			if (s)
				return this.stageColumns[
					s.getStageDescription(s.stage())
				];
		}

		/* Other */
		return 7;
	}
	
	Service.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	Service.prototype.fontColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].fontColor;
	}
	
	Service.prototype.flagColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].flagColor;
	}
	
	Service.prototype.poleColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].poleColor;
	}
	
	/* Returns True if the service contains the specified text. */
	Service.prototype.descriptionContains = function(s, prefix)
	{
		var re = new RegExp(prefix + s.replace(/([\.\\\/\^\+])/, "\\$1"), "i");
		if (re.test(this.description()))
			return true;
		
		var services = this.services();
		return services.find(function(d) { return d.description().toLocaleUpperCase() == s; });	
	}
	
	function Service() {
	    cr.IInstance.call(this);
	};
	
	return Service;

})();
cr.Service._servicesPromise = null;
	
cr.ServiceName = (function() {
	ServiceName.prototype = new cr.TranslationInstance();
	
	function ServiceName() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceName;

})();
	
cr.ServiceOrganizationLabel = (function() {
	ServiceOrganizationLabel.prototype = new cr.TranslationInstance();
	
	function ServiceOrganizationLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceOrganizationLabel;

})();
	
cr.ServiceSiteLabel = (function() {
	ServiceSiteLabel.prototype = new cr.TranslationInstance();
	
	function ServiceSiteLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceSiteLabel;

})();
	
cr.ServiceOfferingLabel = (function() {
	ServiceOfferingLabel.prototype = new cr.TranslationInstance();
	
	function ServiceOfferingLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceOfferingLabel;

})();
	
cr.ServiceImplication = (function() {
	ServiceImplication.prototype = new cr.ServiceLinkInstance();
	
	function ServiceImplication() {
	    cr.ServiceLinkInstance.call(this);
	};
	
	return ServiceImplication;

})();
	
cr.Session = (function() {
	Session.prototype = new cr.IInstance();
	Session.prototype._names = null;
	Session.prototype._registrationDeadline = null;
	Session.prototype._start = null;
	Session.prototype._end = null;
	Session.prototype._canRegister = null;
	Session.prototype._inquires = null;
	Session.prototype._enrollments = null;
	Session.prototype._engagements = null;
	Session.prototype._periods = null;
	Session.prototype._enrollmentsPromise = null;
	Session.prototype._engagementsPromise = null;
	Session.prototype._periodsPromise = null;
	
	Session.prototype.names = function(newData)
	{
		if (newData === undefined)
			return this._names;
		else
		{
			this._names = newData.map(function(d)
				{
					var i = new cr.SessionName();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.registrationDeadline = function(newValue)
	{
		if (newValue === undefined)
			return this._registrationDeadline;
		else
		{
		    if (newValue != this._registrationDeadline)
		    {
				this._registrationDeadline = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.start = function(newValue)
	{
		if (newValue === undefined)
			return this._start;
		else
		{
		    if (newValue != this._start)
		    {
				this._start = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.end = function(newValue)
	{
		if (newValue === undefined)
			return this._end;
		else
		{
		    if (newValue != this._end)
		    {
				this._end = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.canRegister = function(newValue)
	{
		if (newValue === undefined)
			return this._canRegister;
		else
		{
		    if (newValue != this._canRegister)
		    {
				this._canRegister = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.inquiries = function(newData)
	{
		if (newData === undefined)
			return this._inquiries;
		else
		{
			this._inquiries = newData.map(function(d)
				{
					var i = new cr.Inquiry();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.enrollments = function(newData)
	{
		if (newData === undefined)
			return this._enrollments;
		else
		{
			this._enrollments = newData.map(function(d)
				{
					var i = new cr.Enrollment();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.engagements = function(newData)
	{
		if (newData === undefined)
			return this._engagements;
		else
		{
			this._engagements = newData.map(function(d)
				{
					var i = new cr.Engagement();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	Session.prototype.periods = function(newData)
	{
		if (newData === undefined)
			return this._periods;
		else
		{
			this._periods = newData.map(function(d)
				{
					var i = new cr.Period();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
    Session.prototype.promiseInquiries = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._inquiriesPromise)
        	return this._inquiriesPromise;
        else if (this._inquiries)
        {
        	result = $.Deferred();
        	result.resolve(this._inquiries);
        	return result;
        }
        
        var _this = this;	
        this._inquiriesPromise = cr.getData(
        	{
        		path: 'session/{0}/inquiry'.format(this.id()),
        		fields: [],
        		resultType: cr.Inquiry
        	})
        	.done(function(inquiries)
        		{
        			_this._inquiries = inquiries;
        			_this._inquiries.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(inquiries);
        			return result;
        		});
        return this._inquiriesPromise;
    }
    
    Session.prototype.promiseEnrollments = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._enrollmentsPromise)
        	return this._enrollmentsPromise;
        else if (this._enrollments)
        {
        	result = $.Deferred();
        	result.resolve(this._enrollments);
        	return result;
        }
        
        var _this = this;	
        this._enrollmentsPromise = cr.getData(
        	{
        		path: 'session/{0}/enrollment'.format(this.id()),
        		fields: [],
        		resultType: cr.Enrollment
        	})
        	.done(function(enrollments)
        		{
        			_this._enrollments = enrollments;
        			_this._enrollments.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(enrollments);
        			return result;
        		});
        return this._enrollmentsPromise;
    }
    
    Session.prototype.promiseEngagements = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._engagementsPromise)
        	return this._engagementsPromise;
        else if (this._engagements)
        {
        	result = $.Deferred();
        	result.resolve(this._engagements);
        	return result;
        }
        
        var _this = this;	
        this._engagementsPromise = cr.getData(
        	{
        		path: 'session/{0}/engagement'.format(this.id()),
        		fields: [],
        		resultType: cr.Engagement
        	})
        	.done(function(engagements)
        		{
        			_this._engagements = engagements;
        			_this._engagements.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(engagements);
        			return result;
        		});
        return this._engagementsPromise;
    }
    
	Session.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('name' in d)
			this.names(d['name']);
		this._registrationDeadline = 'registration deadline' in d ? d['registration deadline'] : "";
		this._start = 'start' in d ? d['start'] : "";
		this._end = 'end' in d ? d['end'] : "";
		this._canRegister = 'can register' in d ? d['can register'] : "";
		if ('inquiries' in d)
			this._inquiries = d['inquiries'].map(function(d) {
								var i = new cr.Inquiry();
								i.setData(d);
								return i;
							});
		if ('enrollments' in d)
			this._enrollments = d['enrollments'].map(function(d) {
								var i = new cr.Enrollment();
								i.setData(d);
								return i;
							});
		if ('engagements' in d)
			this._engagements = d['engagements'].map(function(d) {
								var i = new cr.Engagement();
								i.setData(d);
								return i;
							});
		if ('periods' in d)
			this._periods = d['periods'].map(function(d) {
								var i = new cr.Period();
								i.setData(d);
								return i;
							});
    }
    
	Session.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names.map(function(i)
				{
					j = new SessionName();
					j.mergeData(i);
					return j;
				});
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._registrationDeadline) this._registrationDeadline = source._registrationDeadline;
		if (!this._start) this._start = source._start;
		if (!this._end) this._end = source._end;
		if (!this._canRegister) this._canRegister = source._canRegister;
		if (!this._inquiries && source._inquiries)
			this._inquiries = source._inquiries.map(function(d) {
								var i = new cr.Inquiry();
								i.mergeData(d);
								return i;
							});
		if (!this._enrollments && source._enrollments)
				this._enrollments = source._enrollments.map(function(d) {
									var i = new cr.Enrollment();
									i.mergeData(d);
									return i;
								});
		if (!this._engagements && source._engagements)
				this._engagements = source._engagements.map(function(d) {
									var i = new cr.Engagement();
									i.mergeData(d);
									return i;
								});
		if (!this._periods && source._periods)
				this._periods = source._periods.map(function(d) {
									var i = new cr.Period();
									i.mergeData(d);
									return i;
								});
    }
    
	function Session() {
	    cr.IInstance.call(this);
	};
	
	return Session;

})();
	
cr.SessionName = (function() {
	SessionName.prototype = new cr.TranslationInstance();
	
	function SessionName() {
	    cr.TranslationInstance.call(this);
	};
	
	return SessionName;

})();
	
cr.Site = (function() {
	Site.prototype = new cr.IInstance();
	
	function Site() {
	    cr.IInstance.call(this);
	};
	
	return Site;

})();
	
cr.SiteName = (function() {
	SiteName.prototype = new cr.TranslationInstance();
	
	function SiteName() {
	    cr.TranslationInstance.call(this);
	};
	
	return SiteName;

})();
	
cr.Street = (function() {
	Street.prototype = new cr.IInstance();
	
	function Street() {
	    cr.IInstance.call(this);
	};
	
	return Street;

})();

cr.User = (function() {
	User.prototype = new cr.Grantable();
	User.prototype._firstName = null;
	User.prototype._lastName = null;
	User.prototype._birthday = null;
	User.prototype._systemAccess = null;
	User.prototype._emails = null;
	User.prototype._notifications = null;
	User.prototype._notificationsPromise = null;
	User.prototype._path = null;
	User.prototype._pathPromise = null;
	User.prototype._userGrantRequests = null;
	User.prototype._userGrantRequestsPromise = null;
	
	User.prototype.setDefaultValues = function()
	{
		this._firstName = "";
		this._lastName = "";
		this._birthday = "";
		this._systemAccess = "write";
		this._emails = [];
		this._notifications = [];
		this._path = new cr.Path();
		this._userGrantRequests = [];
	}
	
	User.prototype.setData = function(d)
	{
		cr.Grantable.prototype.setData.call(this, d);
		this._firstName = 'first name' in d ? d['first name'] : "";
		this._lastName = 'last name' in d ? d['last name'] : "";
		this._birthday = 'birthday' in d ? d['birthday'] : "";
		this._systemAccess = 'system access' in d ? d['system access'] : null;
		if ('emails' in d)
			this.emails(d['emails']);
		if ('notifications' in d)
			this.notifications(d['notifications']);
		if ('path' in d)
			this.path(d['path']);
		if ('user grant requests' in d)
			this.userGrantRequests(d['user grant requests']);
	}
	
	User.prototype.mergeData = function(source)
	{
		cr.Grantable.prototype.mergeData.call(this, source);
		if (!this._firstName) this._firstName = source._firstName;
		if (!this._lastName) this._lastName = source._lastName;
		if (!this._birthday) this._birthday = source._birthday;
		if (!this._systemAccess) this._systemAccess = source._systemAccess;
		return this;
	}
	
	User.prototype.firstName = function(newValue)
	{
		if (newValue === undefined)
			return this._firstName;
		else
		{
		    if (newValue != this._firstName)
		    {
				this._firstName = newValue;
			}
			return this;
		}
	}
	
	User.prototype.lastName = function(newValue)
	{
		if (newValue === undefined)
			return this._lastName;
		else
		{
		    if (newValue != this._lastName)
		    {
				this._lastName = newValue;
			}
			return this;
		}
	}
	
	User.prototype.birthday = function(newValue)
	{
		if (newValue === undefined)
			return this._birthday;
		else
		{
		    if (newValue != this._birthday)
		    {
				this._birthday = newValue;
			}
			return this;
		}
	}
	
	User.prototype.appendUpdateBirthdayCommand = function(newValue, initialData, sourceObjects)
	{
		if (!newValue)
			throw new Error("Your birthday is required.");
		var birthMonth = newValue.substr(0, 7);
		if (birthMonth.length < 7)
			throw new Error("Your birthday must include a year and a month.");
		this.appendUpdateValueCommand(newValue, 
			this.birthday, 'birthday', initialData, sourceObjects);
		
		var subData = {};
		var subSourceObjects = [];
		this.path().appendUpdateValueCommand(birthMonth, 
		    this.path().birthday, 'birthday', subData, subSourceObjects);
		if (subSourceObjects.length > 0)
		{
			if (!('path' in initialData))
				initialData['path'] = {'id': this.path().id()};
			initialData['path']['birthday'] = subData['birthday'];
			for (var i = 0; i < subSourceObjects.length; ++i)
				sourceObjects.push(subSourceObjects[0]);
		}
	}

	User.prototype.name = function()
	{
		var firstName = user.firstName();
		var lastName = user.lastName();
		if (firstName)
		{
			if (lastName)
				return firstName + " " + lastName;
			else
				return firstName;
		}
		else 
			return lastName;
	}
	
	User.prototype.systemAccess = function(newSystemAccess)
	{
		if (newSystemAccess === undefined)
			return this._systemAccess;
		else
		{
			this._systemAccess = newSystemAccess;
			return this;
		}
	}
	
	User.prototype.path = function(newData)
	{
		if (newData === undefined)
			return this._path;
		else if (newData instanceof cr.Path)
		{
			this._path = newData;
			return this;
		}
		else
		{
			this._path = new cr.Path();
			this._path.setData(newData);
			return this;
		}
	}
	
	User.prototype.emails = function(newData)
	{
		if (newData === undefined)
			return this._emails;
		else
		{
			this._emails = newData.map(function(d)
				{
					var i = new cr.UserEmail();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	User.prototype.notifications = function(newData)
	{
		if (newData === undefined)
			return this._notifications;
		else
		{
			this._notifications = newData.map(function(d)
				{
					var i = new cr.Notification();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
	User.prototype.userGrantRequests = function(newData)
	{
		if (newData === undefined)
			return this._userGrantRequests;
		else
		{
			this._userGrantRequests = newData.map(function(d)
				{
					var i = new cr.UserUserGrantRequest();
					i.setData(d);
					return i;
				});
			return this;
		}
	}
	
    User.prototype.promisePath = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._pathPromise)
        	return this._pathPromise;
        else if (this._path)
        {
        	result = $.Deferred();
        	result.resolve(this._path);
        	return result;
        }
        
        var _this = this;	
        this._pathPromise = cr.getData(
        	{
        		path: 'user/{0}/path'.format(this.id()),
        		fields: ['experience', 'experience/service', 'experience/custom service'],
        		resultType: cr.Path
        	})
        	.done(function(paths)
        		{
        			_this._path = paths[0];
        			result = $.Deferred();
        			result.resolve(paths[0]);
        			return result;
        		});
        return this._pathPromise;
    }
    
    User.prototype.promiseUserGrantRequests = function()
    {
    	p = this.administerCheckPromise();
    	if (p) return p;

        if (this._userGrantRequestsPromise)
        	return this._userGrantRequestsPromise;
        else if (this._userGrantRequests)
        {
        	result = $.Deferred();
        	result.resolve(this._userGrantRequests);
        	return result;
        }
        
        var _this = this;	
        this._userGrantRequestsPromise = cr.getData(
        	{
        		path: 'user/{0}/user grant request'.format(this.id()),
        		fields: [],
        		resultType: cr.UserUserGrantRequest
        	})
        	.done(function(userGrantRequests)
        		{
        			_this._userGrantRequests = userGrantRequests;
        			result = $.Deferred();
        			result.resolve(userGrantRequests);
        			return result;
        		});
        return this._userGrantRequestsPromise;
    }
    
    User.prototype.promiseNotifications = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._notificationsPromise)
        	return this._notificationsPromise;
        else if (this._notifications)
        {
        	result = $.Deferred();
        	result.resolve(this._notifications);
        	return result;
        }
        
        var _this = this;	
        this._notificationsPromise = cr.getData(
        	{
        		path: 'user/{0}/notification'.format(this.id()),
        		fields: [],
        		resultType: cr.Notification
        	})
        	.done(function(notifications)
        		{
        			_this._notifications = notifications;
        			result = $.Deferred();
        			result.resolve(notifications);
        			return result;
        		});
        return this._notificationsPromise;
    }
    
	User.prototype.promiseDataLoaded = function(fields)
	{
		if (this.privilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject("You do not have permission to see information about {0}".format(this.description()));
			return result.promise();
		}
		if (this._dataLoaded)
		{
			var result = $.Deferred();
			result.resolve(this);
			return result.promise();
		}
		else if (this.id())
		{
			var _this = this;
			var jsonArray = {};
			if (fields)
				jsonArray["fields"] = JSON.stringify(fields.filter(function(s) { return s.indexOf("/") < 0; }));
			return $.getJSON(cr.urls.getData + "user/" + this.id() + "/", jsonArray)
				.then(function(json)
					{
						var r2 = $.Deferred();
						try {
							/* If the data length is 0, then this item can not be read. */
							if (json.data.length > 0)
							{
								_this.setData(json.data[0]);
							}
							else
							{
								_this.setDefaultValues();
								_this.privilege(null);
							}
							
							r2.resolve(_this);
						}
						catch (err)
						{
							r2.reject(err);
						}
						return r2;
					},
					cr.thenFail
				 )
				.then(function(instance)
					{
						if (!fields)
							return;
							
						var subFields = fields.filter(function(s) { return s.indexOf("/") >= 0; });
						if (subFields.length == 0)
							return;
						try
						{
							debugger;
							// This code is used to get subField data. Is this necessary?
// 							return $.when.apply(null, subFields.map(
// 									function(s) {
// 										var cellName = s.substring(0, s.indexOf("/"));
// 										var fieldNames = s.substring(s.indexOf("/") + 1).split(",");
// 										try
// 										{
// 											return cr.getCellValues(_this, cellName, fieldNames); 
// 										}
// 										catch(err)
// 										{
// 											var r3 = $.Deferred();
// 											r3.reject(err);
// 											return r3;
// 										}
// 									}))
// 								.then(function()
// 									{
// 										var r3 = $.Deferred();
// 										r3.resolve(cells);
// 										return r3;
// 									},
// 									function(err)
// 									{
// 										var r3 = $.Deferred();
// 										r3.reject(err);
// 										return r3;
// 									});
						}
						catch(err)
						{
							var r3 = $.Deferred();
							r3.reject(err);
							return r3;
						}
					}
				);
		}
		else
		{
			this.setDefaultValues();
		}
	}
	
	function User() {
	    cr.Grantable.call(this);
	};
	
	return User;

})();
	
cr.UserEmail = (function() {
	UserEmail.prototype = new cr.IInstance();
	
	UserEmail.prototype._text = null;
	UserEmail.prototype._position = null;
	
	UserEmail.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
			if (this._text != newValue)
			{
				this._text = newValue;
			}
			return this;
		}
	}
	
	UserEmail.prototype.setDefaultValues = function()
	{
		this._text = "";
		this._position = 0;
	}
	
	UserEmail.prototype.setData = function(d)
	{
		this._text = 'text' in d ? d['text'] : "";
		this._position = 'position' in d ? parseInt(d['position']) : 0;
	}
	
	function UserEmail() {
	    cr.IInstance.call(this);
	};
	
	return UserEmail;

})();
	
cr.UserGrant = (function() {
	UserGrant.prototype = new cr.Grant();
	
	UserGrant.prototype.granteeType = function()
	{
		return cr.User;
	}
	
	function UserGrant() {
	    cr.Grant.call(this);
	};
	
	return UserGrant;

})();
	
cr.UserUserGrantRequest = (function() {
	UserUserGrantRequest.prototype = new cr.AccessInstance();
	
	function UserUserGrantRequest() {
	    cr.AccessInstance.call(this);
	};
	
	return UserUserGrantRequest;

})();
	
cr.signedinUser = new cr.User();

cr.createSignedinUser = function(id, description)
{
	cr.signedinUser.id(id)
	               .description(description)
	               .promiseDataLoaded(['path', cr.fieldNames.systemAccess])
		.then(function()
			{
				$(cr.signedinUser).trigger("signin.cr");
			}, 
			cr.asyncFail);
}

/* Return a new date that will be a UTC date that represents the same date
	as now in the currrent time zone. For example, 10:00 p.m. in Boston on Oct. 21, 2016 should
	be a UTC date of Oct. 21, 2016 even though that time is actually a UTC Date of Oct. 22, 2016.
 */ 
function getUTCTodayDate()
{
	var startMinDate = new Date();
	return new Date(Date.UTC(startMinDate.getFullYear(), startMinDate.getMonth(), startMinDate.getDate(), 0, 0, 0));
}

/* Given an ISO Date string, return a locale date string */
function getLocaleDateString(s)
{
	if (s.length == 7)
		return Date.CultureInfo.monthNames[parseInt(s.substr(5)) - 1] + " " + s.substr(0, 4);
	else if (s.length == 10)
	{
		var a = new Date(s);
		
		/* Offset is set to set the time to 1:00 a.m. in the local time zone. Since creating
			a new date sets the time to midnight UTC, we need to set it an hour later in case 
			daylight saving's time is in effect. To account for different time zones, we 
			add an hour if the offset is positive, or subtract an hour if the offset is negative.
		 */
		var offset = (a.getTimezoneOffset()) * 60 * 1000;
		
		if (offset >= 0)
			offset += 60 * 60 * 1000;
		else
			offset -= 60 * 60 * 1000;
			
		a.setTime(a.getTime() + offset);
		return a.toLocaleDateString();
	}
	else
		return s;
}

