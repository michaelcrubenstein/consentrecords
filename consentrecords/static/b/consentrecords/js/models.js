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
		if (i.getInstanceID())
		{
			if (!(i.getInstanceID() in this.instances))
			{
				this.instances[i.getInstanceID()] = i;
				return i;
			}
			else
			{
				var oldInstance = this.instances[i.getInstanceID()];
				if (i.areCellsLoaded())
				{
					if (!oldInstance.getCells())
					{
						oldInstance.setCells(i.getCells());
					}
					else 
					{
						i.getCells().forEach(function(cell)
							{
								if (!oldInstance.getCell(cell.field.name))
								{
									oldInstance.importCell(cell);
								}
							});
					}
				}
				if (!oldInstance.getTypeName() && i.getTypeName())
					oldInstance.setTypeName(i.getTypeName());
				return oldInstance;
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
		
		var promise = cr.getData({path: args.path, 
					start: args.start,
					end: args.end,
					fields: args.fields})
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
    term: 'term',
    name: 'name',
    configuration: 'configuration',
    field: 'field',
    boolean: 'boolean',
    dataType: 'data type',
    ofKind: 'of kind',
    pickObjectPath: 'pick object path',
    enumerator: 'enumerator',
    maxCapacity: 'max capacity',
    addObjectRule: 'object add rule',
    descriptorType: 'descriptor type',
    user: 'user',
    userID: 'userID',
    email: 'email',
    firstName: 'first name',
    lastName: 'last name',
    text: 'text',
    accessRecord: 'access record',
    accessRequest: 'access request',
    systemAccess: 'system access',
    privilege: 'privilege',
    group: 'group',
    defaultAccess: 'default access',
    specialAccess: 'special access',
    publicAccess: 'public access',
    primaryAdministrator: 'primary administrator',
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
		else if (this.id == null)	/* It was never saved */
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
	
	Instance.prototype.areCellsLoaded = function()
	{
		return this._cells !== null;
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
	
	Instance.prototype.subInstance = function(name)
	{
		var value = this.getValue(name);
		return value && value.instance();
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

	Instance.prototype.importCells = function(oldCells)
	{
		this._cells = [];
		for (var j = 0; j < oldCells.length; ++j)
		{
			this.importCell(oldCells[j]);
		}
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
							json.fields.forEach(function(field)
								{
									crp.pushField(field);
								});
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
		if (storedI && storedI.areCellsLoaded())
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
	
	ObjectValue.prototype.areCellsLoaded = function()
	{
		return this._instance.areCellsLoaded();
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
			if (!this.getInstanceID())
				return;
			else
			{
				command = {id: this.id};
				sourceObjects.push(this);
			}
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
		}
		initialData.push(command);
		
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
		
	ObjectValue.prototype.subInstance = function(name)
	{
		return this._instance && this._instance.subInstance(name);
	}
	
	ObjectValue.prototype.importCell = function(cell)
	{
		this._instance.importCell(cell);
	}

	ObjectValue.prototype.importCells = function(cells)
	{
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
		var storedI = crp.getInstance(this.getInstanceID());
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

cr.signedinUser = new cr.ObjectValue();

cr.createSignedinUser = function(instanceID, description)
{
	cr.signedinUser.instance(new cr.Instance());
	cr.signedinUser.setInstanceID(instanceID);
	cr.signedinUser.setDescription(description);
	cr.signedinUser.promiseCellsFromCache([cr.fieldNames.systemAccess])
		.then(function()
			{
				$(cr.signedinUser).trigger("signin.cr");
			}, 
			cr.asyncFail);
}

cr.cellFactory = {
	_string: cr.StringCell,
	_number: cr.NumberCell,
	_email: cr.EmailCell,
	_url: cr.UrlCell,
	_telephone: cr.TelephoneCell,
	_translation: cr.TranslationCell, 
	_datestamp: cr.DatestampCell, 
	"_datestamp (day optional)": cr.DatestampDayOptionalCell,
	_time: cr.TimeCell,
	_object: cr.ObjectCell,
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
		getValues : "/api/getvalues/",
		getUserID : "/api/getuserid/",
		getData : "/api/getdata/",
		getConfiguration : "/api/getconfiguration/",
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
		failFunction(cr.postError(jqXHR, textStatus, errorThrown));
	};

cr.thenFail = function(jqXHR, textStatus, errorThrown)
	{
		var r2 = $.Deferred();
		r2.reject(cr.postError(jqXHR, textStatus, errorThrown));
		return r2;
	};
	
/* args is an object with up to seven parameters: path, field, value, start, end, done, fail.
	The done method takes a single argument, which is an array of value objects. */
cr.getValues = function (args)
	{
		var data = {};
		if (args.path)
			data.path = args.path;
		else
			throw "path was not specified to getValues"
			
		if (args.field)
			data.fieldName = args.field;
		else
			throw "field was not specified to getValues"
			
		if (args.value)
			data.value = args.value;
		if (args.fields)
			data.fields = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data.access_token = cr.accessToken;
			
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.getValues, data)
			.then(function(json)
				{
					json.fields.forEach(function(field)
						{
							crp.pushField(field);
						});
					var newObjects = json.values.map(cr.ObjectCell.prototype.copyValue);
					try
					{
						if (args.done)
							args.done(newObjects);
						var result = $.Deferred();
						result.resolve(newObjects);
						return result;
					}
					catch(err)
					{
						if (args.fail)
							args.fail(err);
						var result = $.Deferred();
						result.reject(err);
						return result;
					}
				},
				function(jqXHR, textStatus, errorThrown)
				{
					var resultText = cr.postError(jqXHR, textStatus, errorThrown);
					if (args.fail)
						args.fail(resultText);
					var result = $.Deferred();
					result.reject(resultText);
					return result;
				});
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
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
			
		return $.ajax({
				url: cr.urls.getData + "value/" + valueID + "/",
				type: 'DELETE',
			})
			.then(function(json, textStatus, jqXHR)
			{
				successFunction(valueID);
			},
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

cr.getConfiguration = function(parent, typeID)
	{
		var data;
		if (/^[A-Za-z0-9]{32}$/.test(typeID))
			data = {"typeID" : typeID};
		else
			data = {"typeName" : typeID};
		return $.getJSON(cr.urls.getConfiguration, data)
		.then(function(json)
			{
				var cells = [];
				json.cells.forEach(function(cell)
				{
					crp.pushField(cell.field);
					var newCell = cr.createCell(cell.field.id);
					newCell.setup(parent);
					cells.push(newCell);
				});
				return cells;
			},
			cr.postError);
	},
	
	
/* 
	args is an object with up to four parameters: path, fields, done, fail
 */
cr.getData = function(args)
	{
		if (!args.path)
			throw new Error("path is not specified to getData");
			
		var data = {};
		if (args.fields)
			data['fields'] = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.getData + encodeURIComponent(args.path) + "/", data)
			.then(function(json)
				{
					try
					{
						if (json.fields)
						{
							json.fields.forEach(function(field)
								{
									crp.pushField(field);
								});
						}
						return json.data.map(cr.ObjectCell.prototype.copyValue);
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
		var path = '#{0}'.format(object.getInstanceID());
		return cr.getValues({path: path, field: cellName, fields: fieldNames})
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
