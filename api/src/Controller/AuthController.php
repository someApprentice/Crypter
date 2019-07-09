<?php
namespace Crypter\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Cookie;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\IsGranted;

use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoderInterface;

use Crypter\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

use \Firebase\JWT\JWT;

class AuthController extends AbstractController
{
    private $validator;

    private $em;

    private $passwordEncoder;

    public function __construct(ValidatorInterface $validator, EntityManagerInterface $em, UserPasswordEncoderInterface $passwordEncoder)
    {
        $this->validator = $validator;
        $this->em = $em;
        $this->passwordEncoder = $passwordEncoder;
    }

    /**
     * @Route("/api/auth/registrate", methods={"POST"}, name="registrate")
     */
    public function registrate(Request $request): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        // @TODO: BAD_REQUSET IF REQUEIRED FILEDS IS EMPTY

        $user = new User();
        $user->setEmail($data['email']);
        $user->setName($data['name']);
        $user->setPassword($data['password']);
        
        $errors = $this->validator->validate($user);

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $user->setPassword($this->passwordEncoder->encodePassword($user, $data['password']));

        $this->em->persist($user);
        $this->em->flush();

        $uuid = $user->getUuid();
        $email = $user->getEmail();
        $name = $user->getName();
        $hash = $user->getPassword();

        $jwt = JWT::encode(['uuid' => $uuid, 'hash' => $hash], $this->getParameter('JWT_SECRET'));

        $response = new JsonResponse([
            'uuid' => $uuid,
            'email' => $email,
            'name' => $name,
            'jwt' => $jwt
        ]);

        // set secure flag to true when https will implemented
        $response->headers->setCookie(new Cookie('uuid', $uuid, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('email', $email, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('name', $name, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('jwt', $jwt, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));

        return $response;
    }

    /**
     * @Route("/api/auth/login", methods={"POST"}, name="login")
     */
    public function login(Request $request): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        // @TODO: BAD_REQUSET IF REQUEIRED FILEDS IS EMPTY

        $user = new User();
        $user->setEmail($data['email']);
        $user->setPassword($data['password']);


        $errors = new ConstraintViolationList();

        foreach ($this->validator->validateProperty($user, 'email') as $error) {
            $errors->add($error);
        }

        foreach ($this->validator->validateProperty($user, 'password') as $error) {
            $errors->add($error);
        }

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }


        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $data['email']]);

        if (!$user or !$this->passwordEncoder->isPasswordValid($user, $data['password'])) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $uuid = $user->getUuid();
        $email = $user->getEmail();
        $name = $user->getName();
        $hash = $user->getPassword();

        $jwt = JWT::encode(['uuid' => $uuid, 'hash' => $hash], $this->getParameter('JWT_SECRET'));

        $response = new JsonResponse([
            'uuid' => $uuid,
            'email' => $email,
            'name' => $name,
            'jwt' => $jwt
        ]);

        // set secure flag to true when https will implemented
        $response->headers->setCookie(new Cookie('uuid', $uuid, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('email', $email, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('name', $name, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('jwt', $jwt, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));

        return $response;
    }

    /**
      * @Route("/api/auth/logout", methods={"POST"}, name="logout")
      *
      * @IsGranted("ROLE_USER")
      */
     public function logout()
     {
         // controller can be blank: it will never be executed!
         throw new \Exception('Don\'t forget to activate logout in security.yaml');
     }

    /**
     * @Route("/api/auth/email/{email}", name="email_exists")
     */
    public function isEmailExists(string $email): Response
    {
        $user = new User();
        $user->setEmail($email);

        $errors = $this->validator->validateProperty($user, 'email');

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        return new Response('Exists', Response::HTTP_OK);
    }
}