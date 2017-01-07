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
        this.queue.push(function () {
            var finished = callback();
            if (typeof finished === "undefined" || finished) {
                //  if callback returns `false`, then you have to 
                //  call `next` somewhere in the callback
                _this.dequeue();
            }
        });

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
	CRP.prototype.paths = {};
	CRP.prototype.queue = null;
	
    function CRP() {
    	this.instances = {};
    	this.paths = {};
        this.queue = new Queue(true); //initialize the queue
    };
    
    /* Get an instance that has been loaded, or undefined if it hasn't been loaded. */
    CRP.prototype.getInstance = function(id)
    {
    	if (!id)
    		throw("id is not defined");
    	if (id in this.instances)
    		return this.instances[id];
    	else
    		return undefined;
    }

	CRP.prototype.pushID = function(id, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
    	if (!id)
    		throw("id is not defined");
		var _this = this;
		this.queue.add(
			function() {
				if (id in _this.instances) {
					successFunction(_this.instances[id]);
				}
				else
				{
					cr.selectAll({path: "#"+id,})
						.then(function(newInstances)
						{
							_this.instances[id] = newInstances[0];
							successFunction(newInstances[0]);
						}, 
						failFunction);
				}
				return true;
			});
	};
	
	CRP.prototype.pushCheckCells = function(i, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		if (!i)
			throw "i is not defined";
		var _this = this;
		this.queue.add(
			function() {
				i.promiseCells(undefined)
					.then(function() {
						successFunction();
						_this.queue.next();
					},
					failFunction);
				return false;
			});
	};
	
	CRP.prototype.pushInstance = function(i)
	{
		if ("value" in i && "id" in i.value)
		{
			if (!(i.getInstanceID() in this.instances))
			{
				this.instances[i.getInstanceID()] = i;
				return i;
			}
			else
			{
				oldInstance = this.instances[i.getInstanceID()];
				if (!oldInstance.value.getCells() && i.areCellsLoaded())
				{
					oldInstance.value.setCells(i.value.getCells());
				}
				return oldInstance;
			}
		}
		else
			return i;	/* This isn't an object. */
	};
	
	CRP.prototype.getData = function(path, fields, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		if (!path)
			throw "path is not defined";
		var _this = this;
		this.queue.add(
			function() {
				if (path in _this.paths)
					successFunction(_this.paths[path]);
				else
				{
					cr.getData({path: path, 
								fields: fields,
								done: function(newInstances) {
							_this.paths[path] = newInstances;
							$(newInstances).each(function()
								{ crp.pushInstance(this); });
							successFunction(newInstances);
							_this.queue.next();
						}, 
								fail: failFunction});
				}
			});
	};
	
	return CRP;
})();

var crp = new CRP();
