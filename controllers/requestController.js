const Request = require('../models/Request');

exports.createRequest = async (req, res) => {
    const { items, deadline } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: "Minimal satu item harus diinput" });
    }

    try {
        const newRequest = await Request.create({
            user: req.user._id,
            items,
            deadline
        });

        res.status(201).json(newRequest);
        
    } catch (err) {
        console.log(err);
        console.error("Error creating request:", err);
        res.status(500).json({ message: err.message });
    }
};

exports.getAllRequests = async (req, res) => {
    try {
        const requests = await Request.find().populate('user', 'name email');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getRequestById = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id).populate('user', 'name email');
        if (!request) {
            return res.status(404).json({ message: 'Request tidak ditemukan' });
        }
        res.json(request);
    } catch (err) {
        console.error("Error mengambil data request:", err);
        res.status(500).json({ message: err.message });
    }
};


exports.getMyRequests = async (req, res) => {
    try {
      const userId = req.user._id; // Pastikan menggunakan req.user._id
      const requests = await Request.find({ user: userId }).populate('user', 'name email');
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  
  

