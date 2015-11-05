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
	CRP.prototype.queue = null;
	
    function CRP() {
    	this.instances = {};
        this.queue = new Queue(true); //initialize the queue
    };

	CRP.prototype.pushID = function(id, successFunction, failFunction)
	{
		var _this = this;
		this.queue.add(
			function() {
				if (id in _this.instances) {
					successFunction(_this.instances[id]);
				}
				else
				{
					cr.selectAll("#"+id, function(newInstances)
						{
							_this.instances[id] = newInstances[0];
							successFunction(newInstances[0]);
						}, failFunction);
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
				i.checkCells(undefined, undefined,
					function() {
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
			if (!(i.getValueID() in this.instances))
			{
				this.instances[i.getValueID()] = i;
				return i;
			}
			else
			{
				oldInstance = this.instances[i.getValueID()];
				if (!oldInstance.value.cells && i.isDataLoaded)
				{
					oldInstance.value.setCells(i.value.cells);
					oldInstance.isDataLoaded = true;
				}
				return oldInstance;
			}
		}
		else
			return i;	/* This isn't an object. */
	};
	
	return CRP;
})();

var crp = new CRP();
