import User from '../models/User.js';

export const getAllUsersController = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ users });
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch users' });
  }
};

export const updateUserRoleController = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return res.status(400).json({ msg: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({ msg: 'User role updated successfully', user });
  } catch (error) {
    res.status(500).json({ msg: 'Update failed' });
  }
};

export const deactivateUserController = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({ msg: 'User deactivated successfully', user });
  } catch (error) {
    res.status(500).json({ msg: 'Deactivation failed' });
  }
};