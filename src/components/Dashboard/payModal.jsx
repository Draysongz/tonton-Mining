import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Heading,
  IconButton,
  Text,
  Button,
  ButtonGroup,
  Stack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Flex,
  Table,
  Tbody,
  Tr,
  Td,
  TableContainer,
  Image,
  FormControl,
  FormLabel,
  Input,
  Select,
  RadioGroup,
  Radio,
  Divider,
  Icon,
  Box,
  SimpleGrid,
  useColorModeValue,
} from "@chakra-ui/react";
import { FaRegCreditCard } from "react-icons/fa";
import { FaCcMastercard } from "react-icons/fa";
import { FaCcVisa } from "react-icons/fa";
import { SiTether } from "react-icons/si";
import { SiBinance } from "react-icons/si";
import { SiBitcoincash } from "react-icons/si";
import Rec9 from "../../images/Rectangle9.png";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import axios from "axios";
import { loadStripe } from "@stripe/stripe-js";
import CountrySelector from "./selectCountry";
import { countryList } from "../countries";
import { IoDiamond } from "react-icons/io5";
import { v4 as uuidv4 } from "uuid";

import {
  getFirestore,
  getDoc,
  doc,
  query,
  collection,
  where,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { app } from "../../../Firebase/firebase";
import { useRouter } from "next/router";
import { db } from "../../../Firebase/firebase";
import Miner from "@/pages/api/Controllers/miner";
import { TonConnectButton } from "@tonconnect/ui-react";
import { useTonConnect } from "@/hooks/useTonConnect";
import { useJettonWallet } from "@/hooks/useJettonWallet";
import { fromNano, toNano } from "ton-core";
import { useTonClient } from "@/hooks/useTonClient";
import { createMiner } from "@/utils/updatedb";
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

// const handleCheckout = async (power, userId) => {
//   console.log(power, userId);
//   // const stripe = await stripePromise;
//   // const response = await fetch("/api/route", {
//   //   method: "POST",
//   //   headers: {
//   //     "Content-Type": "application/json",
//   //   },
//   //   body: JSON.stringify({
//   //     amount: power * 24,
//   //     userId: userId,
//   //   }),
//   // });
//   // const session = await response.json();

//   // const result = await stripe.redirectToCheckout({
//   //   sessionId: session.sessionId,
//   // });

//   // if (result.error) {
//   //   alert(result.error.message);
//   // }
// };

export default function PaymentModal({
  user,
  payout,
  power,
  closeCreateModal,
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { userAddress, connected } = useTonConnect();
  const { getBalance, transfer } = useJettonWallet();
  const [userBalance, setUserBalance] = useState();
  const client = useTonClient();

  useEffect(() => {
    (async () => {
      const bal = await getBalance();

      if (bal == undefined) return;
      setUserBalance(fromNano(bal));
    })();

    return () => {};
  }, [client, userAddress, connected, getBalance, userBalance]);

  // useEffect(() => {
  //   if (!userBalance) return;
  //   console.log(userBalance);
  //   validatePayment();
  // }, [user, userBalance]);

  const validatePayment = async () => {
    const docRef = doc(db, "users", user.userId);
    const userQs = await getDoc(docRef);
    if (userQs.exists()) {
      const userData = userQs.data();
      const oldBalance = userData.oldUserBalance;
      const unverifiedPaidAmount = userData.unverifiedAmount;
      const oldPower = userData.oldPower;
      const oldCost = userData.oldCost;
      console.log("user data ok", userData, oldBalance, unverifiedPaidAmount);
      if (oldBalance && unverifiedPaidAmount) {
        console.log("data intact", oldBalance, unverifiedPaidAmount);
        await verifyTx(
          Number(unverifiedPaidAmount),
          Number(oldBalance),
          Number(oldPower),
          Number(oldCost),
          user.userId
        );
      }
    }
  };

  const verifyTx = async (paidAmount, oldBalance, power, cost, userId) => {
    const intervalId = setInterval(async () => {
      let bal = await getBalance();
      if (!bal) return;
      bal = Number(fromNano(bal));
      if (bal <= oldBalance - paidAmount) {
        clearInterval(intervalId);
        const newBal = bal;
        setUserBalance(newBal);
        await createMiner(power, cost, userId);
        await updateUserWithAmount(userId, "", "", "", "");
      }
      console.log(bal);
    }, 2000);
    setTimeout(() => clearInterval(intervalId), 1800000);
  };

  async function updateUserWithAmount(
    userId,
    amount,
    oldUserBalance,
    oldPower,
    oldCost
  ) {
    const userRef = doc(db, "users", userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      console.log("updating db", userId);
      await updateDoc(userRef, {
        unverifiedAmount: String(amount),
        oldUserBalance: String(oldUserBalance),
        oldPower: String(oldPower),
        oldCost: String(oldCost),
      });
    }
  }

  const sleep = async (time) =>
    new Promise((resolve) => setTimeout(resolve, time));

  const handleCheckout = async (power, user) => {
    if (power == 0) return toast.error("Enter a number greater than zero");
    if (!user) return;
    let amount;
    if (power > 1) {
      amount = power * 35 * 0.9; // 10% discount applied
    } else {
      amount = power * 35;
    }
    onClose();
    closeCreateModal();
    if (userBalance == undefined) return;
    if (userBalance == "0")
      return toast.success("You do not have enough for this transaction");
    const pricePerTonTon = await fetchTokenPrice();
    const toPay = amount / Number(pricePerTonTon);
    console.log("You are paying", toPay);
    console.log("my balance", userBalance);
    await updateUserWithAmount(
      user.userId,
      toPay,
      Number(userBalance),
      power,
      amount
    );
    await transfer(toPay);
    await sleep(3000);
    // await verifyTx(toPay, power, amount, user.userId);
    await validatePayment();
  };

  const fetchTokenPrice = async () => {
    const url =
      "https://api.dexscreener.com/latest/dex/pairs/ton/EQCiCxCExlV7gZ9o6YlOj4GVm402yK5Aun2q53IP-y9Ik3U9";
    const resp = await fetch(url);
    const data = await resp.json();
    const pair = data.pair;
    const priceInUSD = pair.priceUsd;
    return priceInUSD;
  };

 

  const [miner, setMiner] = useState(null);
  const [balance, setBalance] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(0);

  const handleStartMining = async (e) => {
    e.preventDefault();

    const cost = power * 35;
    console.log(
      `the userId is ${user.userId}, with power ${power} which costs ${cost}`
    );
    startMining(user.userId, power, cost);
    toast.success("Miner created");
    onClose();
  };
  const [showForm, setShowForm] = useState(false); // Initialize showForm state
  const handleRadioChange = () => {
    setShowForm((prevState) => !prevState);
  };

  const handleCrypto = async (power, user) => {
    if (power == 0) return toast.error("Enter a number greater than zero");
    if (power > 1) {
      const amount = power * 35 * 0.9; // 10% discount applied
      await pay(amount, user);
    } else {
      // Calculate the amount without any discount if power is not greater than 1
      const amount = power * 35;
      await pay(amount, user);
    }
  };

  const pay = async (amount, user) => {
    try {
      console.log("handling cryptoo...");
      const response = await fetch("/api/makePayment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount, // Use the regular amount here
          orderId: uuidv4(),
          email: user?.Email,
          power,
          userId: user.userId,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log("Invoice creation successful:", data);
        // await createMiner(power, 24); // can set cost later from create modal
        toast.success("Invoice generation successful!");
        // Redirect to the payment link provided by the API
        window.location.href = data.payLink;
      } else {
        // If the response is not OK, throw an error with the message returned by the server (if any)
        throw new Error(data.error || "Failed to make payment");
      }
    } catch (error) {
      // Catch any errors in the fetch operation or JSON parsing and display an error toast
      console.error("Payment Error:", error);
      toast.error(`Payment failed: ${error.code || "Unknown error"}`);
    }
  };

  const handlePayment = async () => {
    console.log(power);
    if (selectedPaymentMethod === 1) {
      await handleCheckout(power, user); // Assume this is already implemented
    } else if (selectedPaymentMethod === 0) {
      console.log("selectedpayment method", selectedPaymentMethod);
      await handleCrypto(power, user); // You need to implement this
    }
  };

  return (
    <>
      <Button
        bg="#3b49df"
        align={"center"}
        color="white"
        _hover="inherit"
        onClick={onOpen}
      >
        Next
      </Button>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent
          bg={useColorModeValue("#fff", "#10062D")}
          color={useColorModeValue("#10062D", "#fff")}
          border="2px solid"
          borderColor={useColorModeValue("#EDE8FC", "#301287")}
        >
          <ModalHeader textAlign={"center"}>Payment method</ModalHeader>
          <ModalBody>
            <Stack>
              <Text fontSize={"xs"}>
                The miner will belong to you permanently. You'll be able to mint
                it to your wallet, upgrade it, and resell it anytime.
              </Text>
              <Tabs
                variant="line"
                textColor="white"
                onChange={(index) => setSelectedPaymentMethod(index)}
              >
                <TabList gap={1} mb={2} border={"none"}>
                  <Tab
                    textColor={useColorModeValue("#200C5A", "#fff")}
                    rounded={"lg"}
                  >
                    By Crypto
                  </Tab>

                  <Tab
                    // isDisabled={true}

                    textColor={useColorModeValue("#200C5A", "#fff")}
                    rounded={"lg"}
                  >
                    Ton Ton
                  </Tab>
                </TabList>
                <TabPanels
                  bg={useColorModeValue("#F9F8FE", "#200C5A")}
                  color={useColorModeValue("#000", "#fff")}
                  boxShadow={`5px 10px 20px 10px ${useColorModeValue(
                    "#501EE133",
                    "none"
                  )}`}
                  rounded={"lg"}
                  mt={3}
                >
                  <TabPanel>
                    {/* <RadioGroup defaultValue="1">
                      <Stack>
                        <Flex justifyContent={"center"}>
                          <Radio value="1">
                            <Flex
                              p={2}
                              align={"center"}
                              gap={2}
                              bg={"gray.400"}
                              w={{ base: "260px", sm: "320px" }}
                              rounded={"lg"}
                            >
                              <Box bg={"orange"} rounded={"full"} p={2}>
                                <Icon
                                  boxSize={6}
                                  as={SiBitcoincash}
                                  color={"yellow.50"}
                                />
                              </Box>
                              <Stack>
                                <Text>Miner</Text>
                                <Text as={"sub"}>ERC-20/BEP-20</Text>
                              </Stack>
                            </Flex>
                          </Radio>
                        </Flex>

                        <Flex justifyContent={"center"}>
                          <Radio value="2">
                            <Flex
                              p={2}
                              align={"center"}
                              gap={2}
                              bg={"gray.400"}
                              w={{ base: "260px", sm: "320px" }}
                              rounded={"lg"}
                            >
                              <Box bg={"green"} rounded={"full"} p={2}>
                                <Icon
                                  boxSize={6}
                                  as={SiTether}
                                  color={"green.50"}
                                />
                              </Box>
                              <Stack>
                                <Text>USDT</Text>
                                <Text as={"sub"}>ERC-20 /BEP-20 / TRC-20</Text>
                              </Stack>
                            </Flex>
                          </Radio>
                        </Flex>

                        <Flex justifyContent={"center"}>
                          <Radio value="3">
                            <Flex
                              p={2}
                              align={"center"}
                              gap={2}
                              bg={"gray.400"}
                              w={{ base: "260px", sm: "320px" }}
                              rounded={"lg"}
                            >
                              <Box bg={"orange"} rounded={"full"} p={2}>
                                <Icon
                                  boxSize={6}
                                  as={SiBinance}
                                  color={"yellow.50"}
                                />
                              </Box>
                              <Stack>
                                <Text>Binance Pay</Text>
                                <Text as={"sub"}>
                                  Pay with your Binance account
                                </Text>
                              </Stack>
                            </Flex>
                          </Radio>
                        </Flex>

                        <Flex justifyContent={"center"}>
                          <Radio value="4">
                            <Flex
                              p={2}
                              align={"center"}
                              gap={2}
                              bg={"gray.400"}
                              w={{ base: "260px", sm: "320px" }}
                              rounded={"lg"}
                            >
                              <Box bg={"blue"} rounded={"full"} p={2}>
                                <Icon
                                  boxSize={6}
                                  as={IoDiamond}
                                  color={"blue.50"}
                                />
                              </Box>
                              <Stack>
                                <Text>Ton</Text>
                                <Text as={"sub"}>Pay with your Ton wallet</Text>
                              </Stack>
                            </Flex>
                          </Radio>
                        </Flex>
                      </Stack>
                    </RadioGroup> */}

                    <Stack p={2}>
                      <Flex align={"center"} justify={"space-between"}>
                        <Text>Price per TH</Text>
                        <Text>$35</Text>
                      </Flex>
                      <Flex align={"center"} justify={"space-between"}>
                        <Text>Historical ROI</Text>
                        <Text>88%</Text>
                      </Flex>
                      <Flex justify={"space-between"} mt={5}>
                        <Flex>
                          <Text>Total</Text>
                        </Flex>
                        <Stack align={"end"}>
                          <Text>
                            {power > 1 ? 35 * 0.9 * power + 1.15 : 35 + 1.15}{" "}
                            USD
                          </Text>
                          <Text>Includes fee 1.15 USD</Text>
                        </Stack>
                      </Flex>
                      <Divider />
                      <Flex>
                        <Text>Promo code</Text>
                      </Flex>
                    </Stack>
                  </TabPanel>

                  <TabPanel>
                    {/* <FormControl p={3}>
                      <FormLabel>Country/Region</FormLabel>
                      <Select
                        placeholder="Select country"
                        textColor={"black"}
                        bg={"gray.300"}
                        className="w-fit"
                      >
                        {countryList.map((country) => (
                          <option className="">{country}</option>
                        ))}
                      </Select>
                    </FormControl> */}
                    {/* <CountrySelector /> */}
                    {/* <Flex
                      p={2}
                      bg={"gray.400"}
                      margin={2}
                      rounded="lg"
                      align={"center"}
                    >
                      <Text fontSize="xs">
                        For more payment options select another country or
                        region
                      </Text>
                    </Flex> */}

                    {/* <RadioGroup p={2} bg="gray.400" margin={2} rounded={"lg"}>
                      <Radio isChecked={showForm} onChange={handleRadioChange}>
                        <Flex align={"center"} gap={2}>
                          <Box bg={"orange"} rounded={"full"} p={2}>
                            {" "}
                            <Icon
                              boxSize={6}
                              as={FaRegCreditCard}
                              color={"yellow.50"}
                            />
                          </Box>
                          <Stack>
                            <Text>By Card</Text>
                            <Flex
                              align={"center"}
                              justify="space-around"
                              gap={1}
                            >
                              <Text fontSize={"10px"} as={"sub"}>
                                USD
                              </Text>
                              <Icon
                                as={FaCcVisa}
                                fontSize="md"
                                color={"yellow.50"}
                                boxSize={5}
                              />
                              <Icon
                                as={FaCcMastercard}
                                fontSize="md"
                                color={"yellow.50"}
                                boxSize={5}
                              />
                            </Flex>
                          </Stack>
                        </Flex>
                      </Radio>
                    </RadioGroup> */}

                    {/* <Flex
                      p={2}
                      bg={"gray.400"}
                      rounded="lg"
                      align={"center"}
                      justify={"center"}
                      m={2}
                    >
                      <Text fontSize="10px">
                        The payment will be processed by a third party. By
                        paying, you agree to buy virtual Miners NFT and
                        automatically add them to your collection.
                      </Text>
                    </Flex> */}
                    {/* <TonConnectButton /> */}
                    <Stack p={2}>
                      <Flex align={"center"} justify={"space-between"}>
                        <Text>Price per TH</Text>
                        <Text>$35</Text>
                      </Flex>
                      <Flex align={"center"} justify={"space-between"}>
                        <Text>Historical ROI</Text>
                        <Text>88%</Text>
                      </Flex>
                      <Flex justify={"space-between"} mt={5}>
                        <Flex>
                          <Text>Total</Text>
                        </Flex>
                        <Stack align={"end"}>
                          <Text>
                            {power > 1 ? 35 * 0.9 * power + 1.15 : 35 + 1.15}{" "}
                            USD
                          </Text>
                          <Text>Includes fee 1.15 USD</Text>
                        </Stack>
                      </Flex>
                      <Divider />
                      <Flex>
                        <Text>Promo code</Text>
                      </Flex>
                    </Stack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Stack>
          </ModalBody>

          <ModalFooter alignContent={"center"} justifyContent={"space-around"}>
            <Button onClick={onClose}>Back</Button>
            <Button
              bg="#3b49df"
              _hover="inherit"
              textColor={"white"}
              mr={3}
              onClick={handlePayment}
            >
              Pay
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
