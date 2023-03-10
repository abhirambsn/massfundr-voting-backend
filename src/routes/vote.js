const express = require("express");
const router = express.Router();

const investorModel = require("../models/investor");
const voteModel = require("../models/vote");
const campaignModel = require("../models/campaign");

const { getTimeDifference } = require("../utils");

const checkForDeadline = async (campaignAddress, stage) => {
  // TODO: Check if the voting period is within the deadline
  const now = new Date(Date.now());
  const campaign = await campaignModel
    .findOne({ address: campaignAddress })
    .exec();
  if (!campaign) {
    return false;
  }
  const deadline = new Date(campaign.deadline);
  if (now > deadline) {
    return true; // Past the deadline
  } else {
    return false; // Within the deadline
  }
};

router.post("/campaign", async (req, res) => {
  const { address, name, stages } = req.body;
  const campaign = new campaignModel({
    address,
    name,
    stages,
  });
  await campaign.save();
  res.status(201).json({ success: true, campaign });
});

router.get("/:campaignAddress", async (req, res) => {
  // TODO: get all votes of a campaign
  const { campaignAddress } = req.params;
  const allVotes = await voteModel
    .findOne({ campaign: campaignAddress })
    .exec();
  return res.status(200).json(allVotes);
});

router.get("/:campaignAddress/:stage/check", async (req, res) => {
  // TODO: Check if a vote for the campaign is created or not
  const { campaignAddress, stage } = req.params;
  const allVotes = await voteModel
    .findOne({ campaign: campaignAddress, stage: parseInt(stage) })
    .exec();
  if (allVotes) {
    return res.status(200).json({ isValid: true });
  }
  return res.status(200).json({ isValid: false });
});

router.post("/:campaignAddress/:stage/check", async (req, res) => {
  // TODO: Check if an investor has voted for the stage of a campaign or not
  const { campaignAddress, stage } = req.params;
  const {address} = req.body;
  const allVotes = await voteModel
    .findOne({ campaign: campaignAddress, stage: parseInt(stage) })
    .exec();
  if (allVotes) {
    const investors = allVotes.votes;
    const voted = investors.find((x) => x.investorAddress === address);
    if (!voted) {
      return res.status(200).json({ voted: false, vote: null });
    }
    return res.status(200).json({ voted: true, vote: voted.vote });
  }
  return res.status(200).json({ voted: false, vote: null });
});

router.post("/:campaignAddress", async (req, res) => {
  // TODO: Add a vote for a campaign
  const { stage, powText } = req.body;
  const { campaignAddress } = req.params;
  const vote = new voteModel({
    campaign: campaignAddress,
    stage: parseInt(stage),
    proofOfWork: { text: powText },
    deadline: new Date(new Date().getTime() + 86400000 * 2),
  });

  await vote.save();
  return res.status(201).json({ success: true });
});

router.post("/:campaignAddress/registerInvestor", async (req, res) => {
  // TODO: Register an investor for a campaign
  const { campaignAddress } = req.params;
  const { investorAddress, name } = req.body;
  const exists = await investorModel
    .findOne({ address: investorAddress })
    .exec();
  if (!exists) {
    const investorData = new investorModel({
      name,
      address: investorAddress,
      investedIn: [campaignAddress],
    });
    await investorData.save();
  } else {
    exists.investedIn.push(campaignAddress);
    await exists.save();
  }
  return res.status(200).json({ success: true });
});

router.post("/:campaignAddress/:stage/vote", async (req, res) => {
  // TODO: Vote for a campaign with the given stage
  const { stage, campaignAddress } = req.params;
  const { yes, investorAddress } = req.body;
  const investor = await investorModel
    .findOne({ address: investorAddress })
    .exec();
  if (!investor) {
    return res
      .status(404)
      .json({ success: false, error: "Investor not registered" });
  }
  const vote = await voteModel
    .findOne({ campaign: campaignAddress, stage: parseInt(stage) })
    .exec();
  if (!vote) {
    return res
      .status(404)
      .json({ success: false, message: "Vote not created" });
  }
  vote.votes.push({ investorAddress, vote: yes });
  await vote.save();
  return res.status(201).json({ success: true, message: "Voted successfully" });
});

router.put("/:campaignAddress/:stage/vote", async (req, res) => {
  // TODO: Change the vote of an investor
  const { campaignAddress, stage } = req.params;
  const { yes, investorAddress } = req.body;
  const investor = await investorModel
    .findOne({ address: investorAddress })
    .exec();
  if (!investor) {
    return res
      .status(404)
      .json({ success: false, error: "Investor not registered" });
  }
  const vote = await voteModel
    .findOne({ campaign: campaignAddress, stage: parseInt(stage) })
    .exec();
  if (!vote) {
    return res
      .status(404)
      .json({ success: false, message: "Vote not created" });
  }
  vote.votes.forEach((vote) => {
    if (vote.investorAddress === investorAddress) {
      vote.vote = yes;
    }
  });
  await vote.save();
});

router.get("/:campaignId/:stage/vote", async (req, res) => {
  // TODO: Get the vote of an investor
  const { campaignAddress, stage } = req.params;
  const { investorAddress } = req.query;
  if (!investorAddress) {
    return res
      .status(404)
      .json({ success: false, message: "Invalid Investor Address" });
  }
  const investor = await investorModel
    .findOne({ address: investorAddress })
    .exec();
  if (!investor) {
    return res
      .status(404)
      .json({ success: false, error: "Investor not registered" });
  }
  const vote = await voteModel
    .findOne({ campaign: campaignAddress, stage: parseInt(stage) })
    .exec();
  if (!vote) {
    return res
      .status(404)
      .json({ success: false, message: "Vote not created" });
  }
  const voter = vote.votes.find(
    (vote) => vote.investorAddress === investorAddress
  );
  if (!voter) {
    return res
      .status(404)
      .json({ success: false, message: "Investor has not voted yet" });
  }
  return res.status(200).json({ success: true, vote: voter });
});

router.get("/:campaignAddress/:stage/stats", async (req, res) => {
  // TODO: Get Stats for the voting of a stage
  const { campaignAddress, stage } = req.params;
  const vote = await voteModel
    .findOne({ campaign: campaignAddress, stage: parseInt(stage) })
    .exec();
  if (!vote) {
    return res
      .status(404)
      .json({ success: false, message: "Vote not created" });
  }

  return res.status(200).json({ success: true, vote });
});

router.get("/results/:campaignAddress/:stage", async (req, res) => {
  const { campaignAddress, stage } = req.params;
  const vote = await voteModel
    .findOne({ campaign: campaignAddress, stage: parseInt(stage) })
    .exec();
  const yay = vote.votes.filter((v) => v.vote === true).length;
  const nay = vote.votes.length - yay;
  

  const timeToOver = getTimeDifference(vote.deadline);
  const over = timeToOver > 0 ? false : true;
  return res.status(200).json({
    yes: yay,
    no: nay,
    deadline: {
      days: Math.floor(timeToOver / 1000 / 60 / 60 / 24),
      hours: Math.floor(timeToOver / 1000 / 60 / 60) % 24,
    }, // hours
    over,
  });
});

module.exports = router;
