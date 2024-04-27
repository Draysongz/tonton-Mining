"use client";
import React, { useEffect, useState } from "react";
import {
  Box,
  Text,
  SimpleGrid,
  Button,
  Flex,
  Card,
  CardFooter,
  Stack,
  Spacer,
  Image,
  Icon,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuItemOption,
  MenuGroup,
  MenuOptionGroup,
  MenuDivider,
} from "@chakra-ui/react";
import nft1 from "../../images/Nft1.png";
import nft2 from "../../images/Nft2.png";
import nft3 from "../../images/Nft3.png";
import NextImage from "next/image";
import { IoMdList } from "react-icons/io";
import CModal from "./createModal";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../../Firebase/firebase";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { IoMdMore } from "react-icons/io";
import { TbTriangleSquareCircle } from "react-icons/tb";
import MintSteps from "../MintSteps";
import { useTonConnect } from "@/hooks/useTonConnect";
import tonweb from "../../../tonweb";
import { useTonClient } from "@/hooks/useTonClient";
import { Address, toNano } from '@ton/core';
import { useMainCOntract } from "@/hooks/useMainContract";



export default function MinerCard() {
  const [minerDeets, setMinerDeets] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [user, setUser] = useState("");
  const [activeMinerId, setActiveMinerId] = useState(null);
  const client = useTonClient()
  const {network, connected, wallet} = useTonConnect()
 



  const handleMintClick = (minerId) => {
    setActiveMinerId(minerId);
    onOpen(); // Open the modal
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('user Id from miner card', user.uid)
        setUser(user.uid)
      } else {
        setUser(null); // Set userdata to null when the user is not logged in
        toast.error("please login");
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleButtonClick = () => {
    setIsOpen(true);
  };


  async function getMinerDetailsByUserId(userId) {
    if (!userId) {
      console.error("No user ID provided");
      return;
    }
  
    const minersRef = collection(db, "miners");
    const q = query(minersRef, where("userId", "==", userId));
  
    try {
      const querySnapshot = await getDocs(q);
      const miners = [];
      querySnapshot.forEach((doc) => {
        miners.push({ id: doc.id, ...doc.data() });
      });
      setMinerDeets(miners); // Depending on your application's structure, you may want to return the data or use it otherwise
    } catch (error) {
      console.error("Error fetching miner details:", error);
      
    }
  }

  useEffect(() => {
    console.log("user from useefec", user)
    getMinerDetailsByUserId(user);
  },[user]);

  useEffect(() => {
    console.log(minerDeets);
  },[minerDeets]);


  
  

  return (
    <>
      <Flex
        direction={"column"}
        p={5}
        h={"100vh"}
        bg={useColorModeValue("white", "#10062D")}
      >
        <Flex p={5} justify={"space-between"}>
          <Button
            border="2px solid"
            borderColor={useColorModeValue("#EDE8FC", "#301287")}
            width={"100px"}
            size={"sm"}
            variant="outline"
            color={useColorModeValue("#10062D", "#fff")}
            leftIcon={<IoMdList />}
            _hover="inherit"
          >
            Filter
          </Button>

          <Button
            bg={useColorModeValue("#EDE8FC", "#301287")}
            color={useColorModeValue("#10062D", "#fff")}
            _hover={{ bg: "#301287" }}
          >
            Upgrade
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 1, sm: 2, md: 2, lg: 4 }} spacing={4}>
          {minerDeets &&
            minerDeets.map((miner) => {
              return (
                <Card
                  key={miner.minerId}
                  border="2px solid #301287"
                  bg="white"
                  rounded={"2xl"}
                  p={5}
                  h={"50vh"}
                >
                  <Image
                    // as={NextImage}
                    objectFit="cover"
                    src={miner?.minerImage}
                    alt="NFT"
                    width="100%"
                  />

                  <Stack p={5}>
                    <Flex
                      align={"start"}
                      justify={"space-between"}
                      alignItems={"center"}
                    >
                      <Text>#{miner?.minerId.slice(0, 7)}</Text>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<IoMdMore />}
                          variant="outline"
                          aria-label="Options"
                        />
                        <MenuList>
                          <MenuItem icon={<TbTriangleSquareCircle />}>
                            Upgrade
                          </MenuItem>
                          <MenuItem
                            onClick={() => handleMintClick(miner.minerId)}
                          >
                            Mint
                          </MenuItem>
                          <MenuItem>View details</MenuItem>
                        </MenuList>
                      </Menu>
                    </Flex>
                    <Text textAlign={"start"}></Text>
                  </Stack>
                </Card>
              );
            })}
        </SimpleGrid>

        {/* Modal for MintSteps */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Mint Miner</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {activeMinerId && <MintSteps minerId={activeMinerId} />}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Flex>
    </>
  );
}
